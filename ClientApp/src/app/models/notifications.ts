
export class Notification {

  id: number;
  message: string;
  createdOn: Date;
  isRead: boolean;
  type?: 'info' | 'warning' | 'success' | 'error';
  timestamp?: Date;
  route?: string;
}


