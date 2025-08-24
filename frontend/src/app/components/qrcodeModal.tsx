// components/QRCodeModal.tsx
"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import * as htmlToImage from "html-to-image";

interface QRCodeModalProps {
  packageId: string;
  isOpen: boolean;
  onClose: () => void;
  size?: number;
}

export default function QRCodeModal({
  packageId,
  isOpen,
  onClose,
  size = 256,
}: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (qrRef.current) {
      const dataUrl = await htmlToImage.toPng(qrRef.current);
      const link = document.createElement("a");
      link.download = `${packageId}-qr.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-100">
      <div className="bg-gray-900 p-6 rounded shadow-lg border border-orange-500 w-[320px] flex flex-col items-center">
        <h3 className="text-orange-400 font-bold mb-4">Package QR Code</h3>

        <div ref={qrRef} className="p-4 bg-black rounded">
          <QRCodeCanvas
            value={packageId}
            size={size}
            bgColor="#000000"
            fgColor="#FFA500"
            level="H"
          />
        </div>

        <p className="mt-2 text-orange-300 mb-4">Package ID: {packageId}</p>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-orange-500 text-black font-semibold rounded hover:bg-orange-600 transition"
          >
            Download
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-orange-400 font-semibold rounded hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
