import React from 'react';

interface Variant {
  id: string;
  name: string;
  type: string;
  stock: number;
  images?: string[];
  price?: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: string | null;
  onSelect: (variantId: string) => void;
  style: 'buttons' | 'circles' | 'thumbnails' | 'dropdown' | 'swatches' | 'table' | 'grid';
  showName?: boolean;
  showStock?: boolean;
  size?: 'small' | 'medium' | 'large';
  variantType: 'color' | 'size';
}

const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariant,
  onSelect,
  style,
  showName = true,
  showStock = true,
  size = 'medium',
  variantType
}) => {
  if (variants.length === 0) return null;

  const sizeClasses = {
    small: 'h-6 w-6 text-xs px-2 py-1',
    medium: 'h-8 w-8 text-sm px-3 py-2',
    large: 'h-10 w-10 text-base px-4 py-3'
  };

  const getColorFromName = (name: string): string => {
    const colorMap: Record<string, string> = {
      'أحمر': '#ef4444',
      'أزرق': '#3b82f6',
      'أخضر': '#10b981',
      'أسود': '#000000',
      'أبيض': '#ffffff',
      'رمادي': '#6b7280',
      'أصفر': '#fbbf24',
      'برتقالي': '#f97316',
      'بنفسجي': '#a855f7',
      'وردي': '#ec4899',
      'red': '#ef4444',
      'blue': '#3b82f6',
      'green': '#10b981',
      'black': '#000000',
      'white': '#ffffff',
      'gray': '#6b7280',
      'grey': '#6b7280',
      'yellow': '#fbbf24',
      'orange': '#f97316',
      'purple': '#a855f7',
      'pink': '#ec4899',
    };
    return colorMap[name.toLowerCase()] || '#6b7280';
  };

  const renderButtons = () => (
    <div className="flex flex-wrap gap-2">
      {variants.map((variant) => (
        <button
          key={variant.id}
          onClick={() => onSelect(variant.id)}
          disabled={variant.stock === 0}
          className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors ${
            selectedVariant === variant.id
              ? 'border-blue-600 bg-blue-50 text-blue-600'
              : variant.stock === 0
              ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-600'
          }`}
        >
          {variant.name}
          {showStock && variant.stock === 0 && ' (غير متوفر)'}
        </button>
      ))}
    </div>
  );

  const renderCircles = () => (
    <div className="flex flex-wrap gap-3">
      {variants.map((variant) => {
        const color = getColorFromName(variant.name);
        return (
          <button
            key={variant.id}
            onClick={() => onSelect(variant.id)}
            disabled={variant.stock === 0}
            className={`relative ${sizeClasses[size]} rounded-full border-2 transition-all ${
              selectedVariant === variant.id
                ? 'border-blue-600 ring-2 ring-blue-200'
                : variant.stock === 0
                ? 'border-gray-300 opacity-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            style={{ backgroundColor: color }}
            title={showName ? variant.name : undefined}
          >
            {selectedVariant === variant.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
      {showName && (
        <div className="flex items-center gap-2 mt-2 w-full">
          {variants.map((variant) => (
            <div key={variant.id} className="flex items-center gap-1">
              <div
                className={`${sizeClasses[size]} rounded-full border-2 ${
                  selectedVariant === variant.id ? 'border-blue-600' : 'border-gray-300'
                }`}
                style={{ backgroundColor: getColorFromName(variant.name) }}
              />
              <span className="text-sm text-gray-700">{variant.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderThumbnails = () => (
    <div className="grid grid-cols-4 gap-2">
      {variants.map((variant) => (
        <button
          key={variant.id}
          onClick={() => onSelect(variant.id)}
          disabled={variant.stock === 0}
          className={`relative border-2 rounded-lg overflow-hidden transition-all ${
            selectedVariant === variant.id
              ? 'border-blue-600 ring-2 ring-blue-200'
              : variant.stock === 0
              ? 'border-gray-300 opacity-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {variant.images && variant.images.length > 0 ? (
            <img
              src={variant.images[0]}
              alt={variant.name}
              className="w-full h-20 object-cover"
            />
          ) : (
            <div
              className="w-full h-20"
              style={{ backgroundColor: getColorFromName(variant.name) }}
            />
          )}
          {showName && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
              {variant.name}
            </div>
          )}
          {selectedVariant === variant.id && (
            <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );

  const renderDropdown = () => (
    <select
      value={selectedVariant || ''}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">اختر {variantType === 'color' ? 'اللون' : 'المقاس'}</option>
      {variants.map((variant) => (
        <option
          key={variant.id}
          value={variant.id}
          disabled={variant.stock === 0}
        >
          {variant.name} {showStock && variant.stock === 0 && '(غير متوفر)'}
        </option>
      ))}
    </select>
  );

  const renderSwatches = () => (
    <div className="space-y-2">
      {variants.map((variant) => {
        const color = getColorFromName(variant.name);
        return (
          <button
            key={variant.id}
            onClick={() => onSelect(variant.id)}
            disabled={variant.stock === 0}
            className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
              selectedVariant === variant.id
                ? 'border-blue-600 bg-blue-50'
                : variant.stock === 0
                ? 'border-gray-300 bg-gray-50 opacity-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <div
              className={`${sizeClasses.medium} rounded-full border-2 ${
                selectedVariant === variant.id ? 'border-blue-600' : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 text-right">
              <div className="font-medium text-gray-900">{variant.name}</div>
              {showStock && (
                <div className="text-xs text-gray-500">
                  {variant.stock > 0 ? `${variant.stock} متبقي` : 'غير متوفر'}
                </div>
              )}
            </div>
            {selectedVariant === variant.id && (
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-right">المقاس</th>
            {showStock && <th className="border border-gray-300 px-4 py-2 text-right">المخزون</th>}
            <th className="border border-gray-300 px-4 py-2 text-right">اختيار</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => (
            <tr
              key={variant.id}
              className={`${
                selectedVariant === variant.id ? 'bg-blue-50' : ''
              } ${variant.stock === 0 ? 'opacity-50' : ''}`}
            >
              <td className="border border-gray-300 px-4 py-2 font-medium">{variant.name}</td>
              {showStock && (
                <td className="border border-gray-300 px-4 py-2">
                  {variant.stock > 0 ? `${variant.stock} قطعة` : 'غير متوفر'}
                </td>
              )}
              <td className="border border-gray-300 px-4 py-2">
                <button
                  onClick={() => onSelect(variant.id)}
                  disabled={variant.stock === 0}
                  className={`px-3 py-1 rounded ${
                    selectedVariant === variant.id
                      ? 'bg-blue-600 text-white'
                      : variant.stock === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {selectedVariant === variant.id ? 'محدد' : 'اختر'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderGrid = () => (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
      {variants.map((variant) => (
        <button
          key={variant.id}
          onClick={() => onSelect(variant.id)}
          disabled={variant.stock === 0}
          className={`p-3 border-2 rounded-lg text-center transition-all ${
            selectedVariant === variant.id
              ? 'border-blue-600 bg-blue-50 text-blue-600'
              : variant.stock === 0
              ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          <div className="font-medium">{variant.name}</div>
          {showStock && (
            <div className="text-xs text-gray-500 mt-1">
              {variant.stock > 0 ? `${variant.stock} متبقي` : 'غير متوفر'}
            </div>
          )}
        </button>
      ))}
    </div>
  );

  switch (style) {
    case 'buttons':
      return renderButtons();
    case 'circles':
      return variantType === 'color' ? renderCircles() : renderButtons();
    case 'thumbnails':
      return variantType === 'color' ? renderThumbnails() : renderButtons();
    case 'dropdown':
      return renderDropdown();
    case 'swatches':
      return variantType === 'color' ? renderSwatches() : renderButtons();
    case 'table':
      return variantType === 'size' ? renderTable() : renderButtons();
    case 'grid':
      return renderGrid();
    default:
      return renderButtons();
  }
};

export default VariantSelector;


