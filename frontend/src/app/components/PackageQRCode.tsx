// components/PackageQRCode.tsx
"use client";

import { QRCodeCanvas } from "qrcode.react";

interface PackageQRCodeProps {
  packageId: string;
  size?: number; // optional, default 256
}

export default function PackageQRCode({
  packageId,
  size = 256,
}: PackageQRCodeProps) {
  if (!packageId) return null;

  return (
    <div className="flex flex-col items-center p-4 bg-gray-900 rounded shadow border border-orange-500">
      <h3 className="text-orange-400 font-semibold mb-2">Package QR Code</h3>
      <QRCodeCanvas
        value={packageId}
        size={size}
        bgColor="#000000"
        fgColor="#FFA500"
        level="H"
      />
      <p className="mt-2 text-orange-300">Package ID: {packageId}</p>
    </div>
  );
}
