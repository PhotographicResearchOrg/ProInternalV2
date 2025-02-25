export class CommentsMetrics {

  public unresponded: number;
  public recentCommentDate: Date;

  constructor() {
    this.unresponded = 0; // Initializing in the constructor
    this.recentCommentDate = new Date();

  }

}
