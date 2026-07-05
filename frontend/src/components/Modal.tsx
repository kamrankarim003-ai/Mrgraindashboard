import { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl bg-white shadow-xl my-8`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-brown">{title}</h2>
          <button onClick={onClose} className="text-brown/60 hover:text-brown">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
