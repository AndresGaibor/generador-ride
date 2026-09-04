declare module 'qrcode/lib/core/qrcode.js' {
  export function create(
    data: string,
    options: { errorCorrectionLevel: string },
  ): {
    version: number;
    maskPattern?: number;
    modules: {
      size: number;
      get(row: number, col: number): number;
    };
  };
}
