import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CartBuilder } from './fixtures/cart-builder';
import { PricingEngine } from '../src/pricing-engine';
import { ShippingMethod } from '../src/types';
import { cartWithShippingArb, userArb, shippingMethodArb } from './fixtures/arbitraries';
import { tracer } from './modules/tracer';

describe('Pricing Engine Strategy', () => {

  // === EXISTING PRICING TESTS (Updated for shipping compatibility) ===
  describe('1. Base Rules (Currency & Tax)', () => {
    it('Example: calculates total correctly for simple cart', () => {
      const result = CartBuilder.new()
        .withItem('Apple', 100, 1)
        .withItem('Banana', 200, 1)
        .calculate(expect.getState().currentTestName);
      expect(result.originalTotal).toBe(300);
      expect(result.finalTotal).toBe(300);
    });

    it('Invariant: Final Total is always <= Original Total', () => {
      const testName = expect.getState().currentTestName!;
      fc.assert(
        fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
          const result = PricingEngine.calculate(items, user, method);
          tracer.log(testName, { items, user, method }, result);
          return result.finalTotal <= result.originalTotal;
        })
      );
    });
  });

  describe('2. Bulk Discounts', () => {
    it('Example: applies 15% discount for 3+ of same SKU', () => {
      const result = CartBuilder.new()
        .withItem('iPad', 100000, 3)
        .calculate(expect.getState().currentTestName);
      expect(result.bulkDiscountTotal).toBe(45000); // 15% of 300000
    });

    it('Invariant: Line items with qty >= 3 always have 15% discount', () => {
      const testName = expect.getState().currentTestName!;
      fc.assert(
        fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
          const result = PricingEngine.calculate(items, user, method);
          tracer.log(testName, { items, user, method }, result);
          result.lineItems.forEach(li => {
            if (li.quantity >= 3) {
              const expectedDiscount = Math.round(li.originalPrice * li.quantity * 0.15);
              expect(li.bulkDiscount).toBe(expectedDiscount);
            } else {
              expect(li.bulkDiscount).toBe(0);
            }
          });
        })
      );
    });
  });

  describe('3. VIP Tier', () => {
    it('Example: applies 5% discount for tenure > 2 years', () => {
      const result = CartBuilder.new()
        .withItem('Widget', 10000, 1)
        .asVipUser()
        .calculate(expect.getState().currentTestName);
      expect(result.vipDiscount).toBe(500);
    });

    it('Invariant: VIP discount is exactly 5% of subtotal (after bulk) if eligible', () => {
      const testName = expect.getState().currentTestName!;
      fc.assert(
        fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
          const result = PricingEngine.calculate(items, user, method);
          tracer.log(testName, { items, user, method }, result);
          if (user.tenureYears > 2) {
            const expected = Math.round(result.subtotalAfterBulk * 0.05);
            expect(result.vipDiscount).toBe(expected);
          } else {
            expect(result.vipDiscount).toBe(0);
          }
        })
      );
    });
  });

  describe('4. Safety Valve', () => {
    it('Invariant: Total Discount strictly NEVER exceeds 30% of Original Total', () => {
      const testName = expect.getState().currentTestName!;
      fc.assert(
        fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
          const result = PricingEngine.calculate(items, user, method);
          tracer.log(testName, { items, user, method }, result);
          const maxAllowed = Math.round(result.originalTotal * 0.30);

          expect(result.totalDiscount).toBeLessThanOrEqual(maxAllowed);

          if (result.isCapped) {
            expect(result.totalDiscount).toBe(maxAllowed);
          }
        })
      );
    });
  });

  // === NEW SHIPPING TESTS ===
  describe('5. Shipping Calculation', () => {

    describe('5.1 Base Shipping & Weight', () => {
      it('Example: Standard shipping has $7 base + $2 per kg', () => {
        const result = CartBuilder.new()
          .withItem('Heavy Item', 10000, 1, 'HEAVY_001', 5.0) // 5kg item
          .withStandardShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.method).toBe(ShippingMethod.STANDARD);
        expect(result.shipment.baseShipping).toBe(700);
        expect(result.shipment.weightSurcharge).toBe(1000); // 5kg × 200 cents
        expect(result.shipment.totalShipping).toBe(1700);
      });

      it('Example: Multiple items sum weights correctly', () => {
        const result = CartBuilder.new()
          .withItem('Widget A', 2000, 2, 'WIDGET_A', 1.5) // 3kg total, $40
          .withItem('Widget B', 3000, 1, 'WIDGET_B', 2.0) // 2kg total, $30
          .withStandardShipping()
          .calculate(expect.getState().currentTestName);

        // Total price = 7000 (< 10000), so no free shipping
        expect(result.shipment.weightSurcharge).toBe(1000); // 5kg × 200 cents
        expect(result.shipment.totalShipping).toBe(1700); // 700 base + 1000 weight
      });

      it('Invariant: Standard shipping = $7 + (totalKg × $2)', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, (items, user) => {
            const result = PricingEngine.calculate(items, user, ShippingMethod.STANDARD);
            tracer.log(testName, { items, user, method: ShippingMethod.STANDARD }, result);

            // Calculate expected weight
            const totalWeight = items.reduce((sum, item) => sum + (item.weightInKg * item.quantity), 0);
            const expectedWeightCharge = Math.round(totalWeight * 200);
            const expectedTotal = 700 + expectedWeightCharge;

            if (!result.shipment.isFreeShipping) {
              expect(result.shipment.baseShipping).toBe(700);
              expect(result.shipment.weightSurcharge).toBe(expectedWeightCharge);
              expect(result.shipment.totalShipping).toBe(expectedTotal);
            } else {
              expect(result.shipment.totalShipping).toBe(0);
            }
            return true;
          })
        );
      });
    });

    describe('5.2 Free Shipping Threshold', () => {
      it('Example: Orders over $100 get free shipping', () => {
        const result = CartBuilder.new()
          .withItem('Expensive Item', 10500, 1, 'EXPENSIVE', 1.0)
          .withStandardShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.isFreeShipping).toBe(true);
        expect(result.shipment.totalShipping).toBe(0);
      });

      it('Example: Orders at exactly $100 do NOT get free shipping', () => {
        const result = CartBuilder.new()
          .withItem('Exactly $100', 10000, 1, 'EXACT_100', 1.0)
          .withStandardShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.isFreeShipping).toBe(false);
        expect(result.shipment.totalShipping).toBeGreaterThan(0);
      });

      it('Example: Discounts can enable free shipping', () => {
        const result = CartBuilder.new()
          .withItem('Widget', 11000, 3, 'WIDGET', 1.0) // 33000 original, 28050 post-bulk
          .withStandardShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.finalTotal).toBeGreaterThan(10000);
        expect(result.shipment.isFreeShipping).toBe(true);
        expect(result.shipment.totalShipping).toBe(0);
      });

      it('Invariant: Free shipping when discounted subtotal > $100', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, (items, user) => {
            const result = PricingEngine.calculate(items, user, ShippingMethod.STANDARD);
            tracer.log(testName, { items, user, method: ShippingMethod.STANDARD }, result);

            if (result.finalTotal > 10000) {
              expect(result.shipment.isFreeShipping).toBe(true);
              expect(result.shipment.totalShipping).toBe(0);
            } else {
              expect(result.shipment.isFreeShipping).toBe(false);
            }
            return true;
          })
        );
      });
    });

    describe('5.3 Expedited Shipping', () => {
      it('Example: Expedited adds 15% of original subtotal', () => {
        const result = CartBuilder.new()
          .withItem('Item', 5000, 1, 'ITEM_001', 0) // $50, 0kg
          .withExpeditedShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.method).toBe(ShippingMethod.EXPEDITED);
        expect(result.shipment.expeditedSurcharge).toBe(750); // 15% of 5000
        expect(result.shipment.totalShipping).toBe(1450); // 700 + 0 weight + 750
      });

      it('Example: Expedited 15% applied BEFORE discounts', () => {
        const result = CartBuilder.new()
          .withItem('Discounted Item', 3000, 3, 'DISCOUNTED', 0) // 9000 original, $90
          .withExpeditedShipping()
          .calculate(expect.getState().currentTestName);

        // Subtotal after bulk = 9000 - 15% = 7650 (< 10000)
        // Expedited surcharge based on original subtotal
        expect(result.shipment.expeditedSurcharge).toBe(1350); // 15% of 9000

        // Bulk discount still applies to product total
        expect(result.bulkDiscountTotal).toBe(1350); // 15% of 9000
      });

      it('Invariant: Expedited surcharge = 15% of original subtotal', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, (items, user) => {
            const result = PricingEngine.calculate(items, user, ShippingMethod.EXPEDITED);
            tracer.log(testName, { items, user, method: ShippingMethod.EXPEDITED }, result);

            if (!result.shipment.isFreeShipping) {
              const expectedSurcharge = Math.round(result.originalTotal * 0.15);
              expect(result.shipment.expeditedSurcharge).toBe(expectedSurcharge);
            } else {
              expect(result.shipment.expeditedSurcharge).toBe(0);
            }
            return true;
          })
        );
      });
    });

    describe('5.4 Express Delivery', () => {
      it('Example: Express is fixed $25 regardless of weight/discount', () => {
        const result = CartBuilder.new()
          .withItem('Heavy Item', 10000, 5, 'HEAVY', 10.0) // 50kg total
          .withExpressShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.method).toBe(ShippingMethod.EXPRESS);
        expect(result.shipment.totalShipping).toBe(2500);
        expect(result.shipment.baseShipping).toBe(0); // Overridden
        expect(result.shipment.weightSurcharge).toBe(0); // Overridden
      });

      it('Example: Express overrides free shipping', () => {
        const result = CartBuilder.new()
          .withItem('Expensive Item', 20000, 1, 'EXPENSIVE', 1.0)
          .withExpressShipping()
          .calculate(expect.getState().currentTestName);

        expect(result.shipment.isFreeShipping).toBe(false);
        expect(result.shipment.totalShipping).toBe(2500);
      });

      it('Invariant: Express delivery always costs exactly $25', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, (items, user) => {
            const result = PricingEngine.calculate(items, user, ShippingMethod.EXPRESS);
            tracer.log(testName, { items, user, method: ShippingMethod.EXPRESS }, result);

            expect(result.shipment.totalShipping).toBe(2500);
            expect(result.shipment.baseShipping).toBe(0);
            expect(result.shipment.weightSurcharge).toBe(0);
            expect(result.shipment.expeditedSurcharge).toBe(0);
            return true;
          })
        );
      });
    });

    describe('5.5 Compositional Invariants', () => {
      it('Invariant: Shipping costs are NEVER included in product discount cap', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
            const result = PricingEngine.calculate(items, user, method);
            tracer.log(testName, { items, user, method }, result);

            // Product discount cap should be exactly 30% of original total
            const maxProductDiscount = Math.round(result.originalTotal * 0.30);
            expect(result.totalDiscount).toBeLessThanOrEqual(maxProductDiscount);

            // Shipping should be additive on top
            expect(result.grandTotal).toBe(result.finalTotal + result.shipment.totalShipping);
            return true;
          })
        );
      });

      it('Invariant: Shipping is calculated AFTER all product discounts', () => {
        const testName = expect.getState().currentTestName!;
        fc.assert(
          fc.property(cartWithShippingArb, userArb, shippingMethodArb, (items, user, method) => {
            const result = PricingEngine.calculate(items, user, method);
            tracer.log(testName, { items, user, method }, result);

            // Free shipping depends on discounted total
            const freeThresholdMet = result.finalTotal > 10000;

            // If expedited and NOT free, check that surcharge uses original total
            if (method === ShippingMethod.EXPEDITED && !result.shipment.isFreeShipping) {
              const expectedExpedited = Math.round(result.originalTotal * 0.15);
              expect(result.shipment.expeditedSurcharge).toBe(expectedExpedited);
            }

            // If standard and free threshold met
            if (method === ShippingMethod.STANDARD && freeThresholdMet) {
              expect(result.shipment.isFreeShipping).toBe(true);
            }

            return true;
          })
        );
      });
    });
  });
});