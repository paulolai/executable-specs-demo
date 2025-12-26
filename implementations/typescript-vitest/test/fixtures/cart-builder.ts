import { CartItem, User, PricingResult } from '../../src/types';
import { PricingEngine } from '../../src/pricing-engine';
import { tracer } from '../modules/tracer';

export class CartBuilder {
  private items: CartItem[] = [];
  private user: User = { tenureYears: 0 };

  static new(): CartBuilder {
    return new CartBuilder();
  }

  withItem(name: string, price: number, quantity: number, sku?: string): CartBuilder {
    this.items.push({
      sku: sku || name.toUpperCase().replace(/\s+/g, '_'),
      name,
      price,
      quantity
    });
    return this;
  }

  asVipUser(): CartBuilder {
    this.user.tenureYears = 3;
    return this;
  }

  withTenure(years: number): CartBuilder {
    this.user.tenureYears = years;
    return this;
  }

  calculate(): PricingResult {
    const input = { items: this.items, user: this.user };
    const output = PricingEngine.calculate(this.items, this.user);
    
    tracer.log(input, output);
    
    return output;
  }

  // Helper for reporter to see inputs
  getInputs() {
    return {
      items: this.items,
      user: this.user
    };
  }
}
