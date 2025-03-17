import { Injectable } from "@angular/core";
import { Router, UrlSegment } from "@angular/router";
import { ApiService } from "./api.service";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";

@Injectable({
  providedIn: "root",
})


export class AuthService {

  constructor(private router: Router, private api: ApiService, private httpClient: HttpClient, private dataService: DataService,) {}
  //Auth


  set redirectTo(page: string)
  {
    page = "Dashboard-landing"
    alert(page)
    if (page !== '/login')
    {
      sessionStorage.setItem("redirectTo", page);
    }
  }

  login(username: string, password: string)
  {
    alert("HERE")
    this.dataService.login(username, password);

    //  this.store.dispatch(new Login(username, password));
      //this.actions$.pipe(
      //  tap(a => {
      //    if (a.type == UserActionTypes.LOGIN_SUCCESS) {
      //      this.router.navigateByUrl(this.redirectTo);
      //      this.token = (a as LoginSuccess).token;
      //    }

      //  }
      //  )
      //).subscribe()
    



    this.router.navigateByUrl("/Dashboard-landing");
   

 
  }

}


