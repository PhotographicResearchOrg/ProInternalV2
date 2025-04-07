export class comments {

  public comment: string;
  public authorname: string;
  public authoremail: string;
  public created: Date;
  public updated: Date;
  public articleName: string;
  public excerpt: string;
  public articlePublishedAt: Date;
  public avatarUrl: string;
  public expanded?: boolean; 

  constructor(o?: any) {
    Object.assign(this,o);
  }

}
