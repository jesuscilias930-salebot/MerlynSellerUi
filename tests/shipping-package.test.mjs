import test from "node:test";
import assert from "node:assert/strict";
import {bundleShippingPackage,shippingPackageLabel} from "../app/lib/shipping-package.ts";

const bundle={id:2,name:"Caricatura 50 pares",fixedPrice:"446.50",boxLengthCm:"30",boxWidthCm:25,boxHeightCm:"20",boxWeightKg:"1.8"};

test("ecommerce bundles use their real dimensions and weight without fallback values",()=>{
  assert.deepEqual(bundleShippingPackage(bundle),{type:"box",content:bundle.name,amount:1,declaredValue:446.5,weight:1.8,dimensions:{length:30,width:25,height:20}});
});

test("incomplete or invalid bundle measurements cannot be selected for a quotation",()=>{
  for(const field of ["boxLengthCm","boxWidthCm","boxHeightCm","boxWeightKg"]){
    for(const value of [undefined,null,"",0,-1,"invalid",Infinity])assert.equal(bundleShippingPackage({...bundle,[field]:value}),null,`${field}: ${value}`);
  }
});

test("package options identify measurements in cm and weight in kg",()=>{
  assert.equal(shippingPackageLabel(bundle.name,bundleShippingPackage(bundle)),"Caricatura 50 pares · 30 × 25 × 20 cm · 1.8 kg");
  assert.equal(shippingPackageLabel(bundle.name,null),"Caricatura 50 pares · faltan medidas o peso");
});

test("an absent or invalid reference price does not invalidate valid shipping measurements",()=>{
  for(const fixedPrice of [undefined,null,"invalid",-1])assert.equal(bundleShippingPackage({...bundle,fixedPrice}).declaredValue,0);
});
