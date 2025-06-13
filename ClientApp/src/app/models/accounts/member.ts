// src/app/models/member.model.ts

export class Member {
  dba: string;
  legalName: string;
  accountNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  firstName: string;
  lastName: string;
}


export class MemberAddress {
  addressType: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}
