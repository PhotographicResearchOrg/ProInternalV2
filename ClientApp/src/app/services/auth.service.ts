import { Injectable } from "@angular/core";
import { Router, UrlSegment } from "@angular/router";
import { ApiService } from "./api.service";
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Injectable({
  providedIn: "root",
})


export class AuthService {

  constructor(private router: Router, private api: ApiService, private httpClient: HttpClient) {}
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

    this.router.navigateByUrl("/Dashboard-landing");
   

 
  }

}


