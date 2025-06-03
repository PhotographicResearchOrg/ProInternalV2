import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from 'src/app/models/notifications';
import { DataService } from 'src/app/services/data.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  constructor(private dataService: DataService) { }

  load(): void {
    this.dataService.getNotifications().subscribe(notifications => {
      this.notificationsSubject.next(notifications);
    });
  }

  markAsRead(id: number): void {
    const updated = this.notificationsSubject.value.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this.notificationsSubject.next(updated);


    this.dataService.markNotificationAsRead(id).subscribe();
  }


  delete(id: number): void {
    this.notificationsSubject.next(
      this.notificationsSubject.value.filter(n => n.id !== id)
    );
    this.dataService.deleteNotification(id).subscribe();
  }


  set(notifications: Notification[]): void {
    this.notificationsSubject.next(notifications);
  }

  get(): Observable<Notification[]> {
    return this.notifications$;
  }

  getUnreadCount(): number {
    return this.notificationsSubject.value.filter(n => !n.isRead).length;
  }



  clear(): void {
    this.notificationsSubject.next([]);
  }




}
