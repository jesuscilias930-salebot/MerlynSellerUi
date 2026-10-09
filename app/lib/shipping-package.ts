export type ShippingBundle = { id: number; name: string; fixedPrice?: number | string | null; boxLengthCm?: number | string | null; boxWidthCm?: number | string | null; boxHeightCm?: number | string | null; boxWeightKg?: number | string | null };
export type StoredShippingPackage = { type?: string; content?: string; amount?: string | number; declaredValue?: string | number; weight?: string | number; dimensions?: { length?: string | number; width?: string | number; height?: string | number } };
const positive = (value: unknown) => value!=null && value!=="" && Number.isFinite(Number(value)) && Number(value)>0;
export function bundleShippingPackage(bundle: ShippingBundle): StoredShippingPackage | null {
  if(![bundle.boxLengthCm,bundle.boxWidthCm,bundle.boxHeightCm,bundle.boxWeightKg].every(positive))return null;
  const value=Number(bundle.fixedPrice ?? 0);
  return {type:"box",content:bundle.name,amount:1,declaredValue:Number.isFinite(value)&&value>=0?value:0,weight:Number(bundle.boxWeightKg),dimensions:{length:Number(bundle.boxLengthCm),width:Number(bundle.boxWidthCm),height:Number(bundle.boxHeightCm)}};
}
export function shippingPackageLabel(name:string,parcel:StoredShippingPackage|null): string {
  if(!parcel)return `${name} · faltan medidas o peso`;
  return `${name} · ${parcel.dimensions?.length ?? "—"} × ${parcel.dimensions?.width ?? "—"} × ${parcel.dimensions?.height ?? "—"} cm · ${parcel.weight ?? "—"} kg`;
}
