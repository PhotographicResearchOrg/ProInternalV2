import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Message } from 'src/app/prointernalengine/api/message';
import { User } from 'src/app/prointernalengine/api/user';

@Injectable()
export class ChatService {

    _activeUser: User = {
        "id": 1,
      "name": "Jon Gilchrist",
      "image": "stephenshaw.png",
        "status": "active",
        "messages": [

            {
                "text": "Just received our shipment of Epoch tripods. Are we allowed to take the tripod out and use it before the 22nd? I'd like to take one out to create some content for release day. I can obscure the branding if necessary.",
                "ownerId": 1,
                "createdAt": 1652646368718
            },
            {
              "text": "Hi Jon! Feel free to create your own custom content with the Epoch tripod to use on the release date (4/22/24). Please do not put the Epoch out on the sale floor before that date. Thanks!",
                "ownerId": 123,
                "createdAt": 1652646368718
            },
        ],
        "lastSeen": "2d"
    }

    private activeUser = new BehaviorSubject<User>(this._activeUser);

    activeUser$ = this.activeUser.asObservable();

    constructor(private http: HttpClient) { }

    getChatData() {
        return this.http.get<any>('assets/demo/data/chat.json')
            .toPromise()
            .then(res => res.data as any[])
            .then(data => data);
    }

    changeActiveChat(user: User) {
        this._activeUser = user;
        this.activeUser.next(user);
    }

    sendMessage(message: Message) {
        this._activeUser.messages.push(message);
        this.activeUser.next(this._activeUser);
    }
}
