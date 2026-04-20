"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-[#2D3748] group-[.toaster]:text-white group-[.toaster]:border-[#E6A13A]/30',
          description: 'group-[.toast]:text-gray-300',
          actionButton: 'group-[.toast]:bg-[#E6A13A] group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-gray-600 group-[.toast]:text-white',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
