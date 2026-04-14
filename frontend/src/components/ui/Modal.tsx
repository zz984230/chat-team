// src/components/ui/Modal.tsx
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Modal({ open, onClose, children, title }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Content */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-lg w-full mx-4 p-6">
        {title && <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
