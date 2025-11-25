import React, { useState, useEffect } from 'react';

interface Variant {
  id: string;
  name: string;
  type: string;
  stock: number;
  price?: number;
  trackInventory?: boolean;
}

interface CompositeVariantSelectorProps {
  variants: Variant[];
  onSelect: (variantId: string) => void;
  selectedVariantId?: string | null;
}

const CompositeVariantSelector: React.FC<CompositeVariantSelectorProps> = ({
  variants,
  onSelect,
  selectedVariantId
}) => {
  // استخراج الألوان والمقاسات من أسماء المتغيرات المركبة
  const extractAttributes = () => {
    const colors = new Set<string>();
    const sizes = new Set<string>();
    const sizePatterns = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
    const arabicSizePatterns = ['صغير', 'وسط', 'كبير', 'كبير جداً'];
    const numericSizePattern = /^\d{2,3}$/; // مقاسات رقمية مثل 38, 39, 40
    
    variants.forEach(v => {
      const parts = v.name.split(' - ').map(p => p.trim());
      parts.forEach(part => {
        const upperPart = part.toUpperCase();
        if (
          sizePatterns.includes(upperPart) || 
          arabicSizePatterns.includes(part) || 
          numericSizePattern.test(part)
        ) {
          sizes.add(part);
        } else {
          colors.add(part);
        }
      });
    });
    
    return { 
      colors: Array.from(colors), 
      sizes: Array.from(sizes).sort((a, b) => {
        // ترتيب المقاسات
        const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
        const aIndex = sizeOrder.indexOf(a.toUpperCase());
        const bIndex = sizeOrder.indexOf(b.toUpperCase());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        // للمقاسات الرقمية
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.localeCompare(b);
      })
    };
  };

  const { colors, sizes } = extractAttributes();
  
  // تحديد القيم الافتراضية من المتغير المحدد حالياً
  const getInitialSelections = () => {
    if (selectedVariantId) {
      const selectedVariant = variants.find(v => v.id === selectedVariantId);
      if (selectedVariant) {
        const parts = selectedVariant.name.split(' - ').map(p => p.trim());
        let initialColor = null;
        let initialSize = null;
        
        parts.forEach(part => {
          if (colors.includes(part)) initialColor = part;
          if (sizes.includes(part)) initialSize = part;
        });
        
        return { initialColor, initialSize };
      }
    }
    
    // إيجاد أول توليفة متوفرة
    for (const color of colors) {
      for (const size of sizes) {
        const variant = variants.find(v => v.name.includes(color) && v.name.includes(size));
        // متوفر إذا: لا يتتبع المخزون أو لديه مخزون
        if (variant && (variant.trackInventory === false || variant.stock > 0)) {
          return { initialColor: color, initialSize: size };
        }
      }
    }
    
    return { initialColor: colors[0] || null, initialSize: sizes[0] || null };
  };

  const { initialColor, initialSize } = getInitialSelections();
  const [selectedColor, setSelectedColor] = useState<string | null>(initialColor);
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize);

  // استدعاء onSelect عند التحميل الأول إذا كان هناك اختيار افتراضي
  useEffect(() => {
    if (initialColor && initialSize) {
      const matchingVariant = variants.find(v => 
        v.name.includes(initialColor) && v.name.includes(initialSize)
      );
      if (matchingVariant) {
        onSelect(matchingVariant.id);
      }
    }
  }, []); // تشغيل مرة واحدة فقط عند التحميل

  // تحديث المتغير المحدد عند تغيير اللون أو المقاس
  useEffect(() => {
    if (selectedColor && selectedSize) {
      const matchingVariant = variants.find(v => 
        v.name.includes(selectedColor) && v.name.includes(selectedSize)
      );
      if (matchingVariant) {
        onSelect(matchingVariant.id);
      }
    } else if (selectedColor && sizes.length === 0) {
      const matchingVariant = variants.find(v => v.name.includes(selectedColor));
      if (matchingVariant) onSelect(matchingVariant.id);
    } else if (selectedSize && colors.length === 0) {
      const matchingVariant = variants.find(v => v.name.includes(selectedSize));
      if (matchingVariant) onSelect(matchingVariant.id);
    }
  }, [selectedColor, selectedSize, variants, onSelect, sizes.length, colors.length]);

  // التحقق من توفر التوليفة
  const isComboAvailable = (color: string, size: string) => {
    const variant = variants.find(v => 
      v.name.includes(color) && v.name.includes(size)
    );
    // متوفر إذا: لا يتتبع المخزون أو لديه مخزون
    return variant && (variant.trackInventory === false || variant.stock > 0);
  };

  // التحقق من توفر اللون (أي مقاس)
  const isColorAvailable = (color: string) => {
    if (sizes.length === 0) {
      return variants.some(v => v.name.includes(color) && (v.trackInventory === false || v.stock > 0));
    }
    return sizes.some(size => isComboAvailable(color, size));
  };

  // التحقق من توفر المقاس (مع اللون المحدد)
  const isSizeAvailable = (size: string) => {
    if (selectedColor) {
      return isComboAvailable(selectedColor, size);
    }
    return variants.some(v => v.name.includes(size) && (v.trackInventory === false || v.stock > 0));
  };

  return (
    <div className="space-y-4">
      {/* اختيار اللون */}
      {colors.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">اللون:</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = isColorAvailable(color);
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  disabled={!available}
                  className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                    selectedColor === color
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : !available
                      ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                      : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* اختيار المقاس */}
      {sizes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">المقاس:</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = isSizeAvailable(size);
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!available}
                  className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
                    selectedSize === size
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : !available
                      ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                      : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* عرض التوليفة المحددة */}
      {selectedColor && selectedSize && (
        <div className="text-sm text-gray-600 mt-2">
          الاختيار: <span className="font-medium">{selectedColor} - {selectedSize}</span>
          {(() => {
            const variant = variants.find(v => 
              v.name.includes(selectedColor) && v.name.includes(selectedSize)
            );
            if (variant && variant.stock === 0) {
              return <span className="text-red-500 mr-2">(غير متوفر)</span>;
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};

export default CompositeVariantSelector;
