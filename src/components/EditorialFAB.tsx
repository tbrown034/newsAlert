'use client';

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/solid';
import { EditorialModal } from './EditorialModal';
import { EditorialPostCreate } from '@/types/editorial';

interface EditorialFABProps {
  onPostCreated?: () => void;
}

export function EditorialFAB({ onPostCreated }: EditorialFABProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = async (data: EditorialPostCreate) => {
    const response = await fetch('/api/editorial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create post');
    }

    // Notify parent to refresh feed
    onPostCreated?.();
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full
          bg-blue-600 hover:bg-blue-700
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-200
          hover:scale-105 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        "
        aria-label="Create editorial post"
        title="Create editorial post"
      >
        <PlusIcon className="w-7 h-7" />
      </button>

      {/* Modal */}
      <EditorialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
