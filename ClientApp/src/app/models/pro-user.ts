
export class ProUser {

  public username: string;
  public email: string;
  public companyId: number;
  public accountNumber: string;
  public userId: number;
  public userType: string;
  public name: string;
  public avatar: string;
  public permissions: number;
  public value: Array<number>;
  public isLogInAs: boolean;
  public id: number;
  public title: string;
  public imageUrl: string;
  public phone: string;
  public department:string;
 
  public photoUrl: string;

  constructor(o?: any) {
    if (o) {
      this.userId = o.UserId;
      this.username = o.UserName;
      this.email = o.Email;
      this.companyId = o.CompanyId;
      this.accountNumber = o.AccountNumber;
      this.userType = o.MemberType;
      this.name = o.Name;
      this.permissions = o.Permissions;
      this.isLogInAs = o.IsLogInAs == 'True';
      this.id = 0;
      this.title = "";
      this.imageUrl = "";
 
     
    }
  }
  get initials() {
 //   if (!this.name) return '';
 //  return this.name[0] + (this.name.match(/\s([a-zA-Z0-9]){1}/g) ? this.name.match(/\s([a-zA-Z0-9]){1}/g).map(l => l.trim()).join('') : '')

return 'MK'
  }





}
