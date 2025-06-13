
// src/app/models/vendor.model.ts

export class Vendor {
  id: number;
  name: string;
  street: string;
  cityState: string;
  zip: string;
  phone: string;
  shortName: string;
  onWeb: 'Yes' | 'No';
}

