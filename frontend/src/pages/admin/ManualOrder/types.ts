export interface CartItem {
    productId: string;
    variantId?: string; // Optional, for variant support
    name: string;
    variantName?: string; // e.g. "Red / L"
    price: number;
    originalPrice: number;
    quantity: number;
    image: string;
    stock: number;
    color?: string;
    size?: string;
    sku?: string;
}
