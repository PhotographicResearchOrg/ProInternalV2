import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

/* How many server calls are in flight; pages show a spinner while it is above zero. */
@Injectable({ providedIn: 'root' })
export class BusyService {
  private n = 0;
  private timer: any = null;
  /* True while calls are in flight, after a short delay so quick calls don't flash a spinner. */
  busy = false;
  get active(): number { return this.n; }
  start(): void {
    if (this.n++ === 0) this.timer = setTimeout(() => { if (this.n > 0) this.busy = true; }, 250);
  }
  stop(): void {
    this.n = Math.max(0, this.n - 1);
    if (this.n === 0) { clearTimeout(this.timer); this.timer = null; this.busy = false; }
  }
}

@Injectable()
export class BusyInterceptor implements HttpInterceptor {
  constructor(private busy: BusyService) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.busy.start();
    return next.handle(req).pipe(finalize(() => this.busy.stop()));
  }
}
