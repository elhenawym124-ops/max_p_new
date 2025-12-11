import React, { useState } from 'react';
import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';

export interface ProductPageElement {
  id: string;
  label: string;
  enabled: boolean;
}

interface SortableProductPageElementsProps {
  elements: ProductPageElement[];
  onOrderChange: (newOrder: string[]) => void;
  onToggle: (id: string, enabled: boolean) => void;
  disabled?: boolean;
}

const SortableProductPageElements: React.FC<SortableProductPageElementsProps> = ({
  elements,
  onOrderChange,
  onToggle,
  disabled = false
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    e.preventDefault();
    
    const newOrder = [...elements];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    
    const newOrderIds = newOrder.map(el => el.id);
    onOrderChange(newOrderIds);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 mb-4">
        اسحب العناصر لأعلى أو لأسفل لترتيبها في صفحة المنتج
      </p>
      
      <div className="space-y-2">
        {elements.map((element, index) => (
          <div
            key={element.id}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center justify-between p-3 rounded-lg border-2 transition-all
              ${draggedIndex === index 
                ? 'border-indigo-500 bg-indigo-50 opacity-50 cursor-grabbing' 
                : dragOverIndex === index
                ? 'border-indigo-400 bg-indigo-100 border-dashed'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-move'}
            `}
          >
            <div className="flex items-center gap-3 flex-1">
              {/* Drag Handle */}
              <div className={`text-gray-400 ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}>
                <ArrowsUpDownIcon className="h-5 w-5" />
              </div>
              
              {/* Element Label */}
              <span className="text-sm font-medium text-gray-700 flex-1">
                {element.label}
              </span>
              
              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={element.enabled}
                  onChange={(e) => onToggle(element.id, e.target.checked)}
                  disabled={disabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>
        ))}
      </div>
      
      {elements.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          لا توجد عناصر متاحة
        </p>
      )}
    </div>
  );
};

export default SortableProductPageElements;







































