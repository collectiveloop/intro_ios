import { Component, OnInit } from '@angular/core';
import { NavController, NavParams, App } from 'ionic-angular';
import { GooglePlus } from '@ionic-native/google-plus';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpService } from '../../lib/http.service';
import { MessageService } from '../../lib/messages.service';
import { TranslateService } from '@ngx-translate/core';
import { ConfigService } from '../../lib/config.service';
import { TabService } from '../tabs/tabs.service';

@Component({
  selector: 'googleplus-contacts',
  templateUrl: 'googleplus_contacts.html'
})
export class GooglePlusContactsPage implements OnInit {
  page: number = 1;
  accessToken:string='';
  idToken:string='';
  quantity: number = 0;
  contactForm:any;
  infiniteScroll: any;
  listContacts: Array<object> = [];
  maxContacts: number = 0;
  loadingMessage: string = '';
  sent: boolean;
  currentChoice: any;
  destiny: string = '';
  api: string = '';
  googleParams:any = {
    'scopes':'openid https://www.googleapis.com/auth/plus.login https://www.google.com/m8/feeds https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/plus.circles.read https://www.googleapis.com/auth/plus.profile.emails.read',
    'webClientId':this.configService.getGoogleWebClientId(),
    'offline':true
  };

  constructor(private navCtrl: NavController, public app: App, private translateService: TranslateService, private configService: ConfigService, public messages: MessageService, public navParams: NavParams, public sanitizer: DomSanitizer, public googlePlus: GooglePlus, private httpService: HttpService, public tabService:TabService) {
    if (this.navParams.get('destiny') === undefined || this.navParams.get('destiny') === null || this.navParams.get('destiny') === '' || !(this.navParams.get('destiny') !== undefined && this.navParams.get('destiny') !== null)){
      console.log("regresando");
      this.navCtrl.pop();
    }

    this.contactForm = this.navParams.get('contactForm');
    this.destiny = this.navParams.get('destiny');
  }

  public ngOnInit(): void {
    this.tabService.setNotRefresh(false);
    this.sent = false;
    this.translateService.get('LOADING').subscribe(
      value => {
        this.loadingMessage = value;
        this.quantity = this.configService.getQuantity();
        this.api = this.configService.getGoogleApiKey();
        this.page = 1;
        this.initContacts();
      }
    );
  }

  public initContacts(): void {
    this.messages.showMessage({
      content: this.loadingMessage
    });
    this.tabService.setNotRefresh(true);
    this.loginByGooglePlus().then((result) => {
      console.log('llego algo ',result);
      if (result !== false) {
        this.getToken({serverAuthCode:result.serverAuthCode});
      }else{
        this.messages.closeMessage();
      }
    });
  }

  public loginByGooglePlus(): any {
    console.log("aqui");
    return new Promise((resolve, reject) => {
      this.googlePlus.logout()
        .then((success) => {
          this.googlePlus.login(this.googleParams)
            .then((result) => {
              resolve(result);
            })
            .catch(error => {
              resolve(false);
            });
        }, (error) => {
          console.log("segundo intento");
          this.googlePlus.login(this.googleParams)
            .then((result) => {
              resolve(result);
            })
            .catch(error => {
              console.error(error);//cuando se cancela
              resolve(false);
            });
        });
    });
  }

  public getToken(config:any): void {
    //this.configService.getGoogleApiKey()
    let params = {
      url: 'https://accounts.google.com/o/oauth2/token',
      urlParams: [],
      clientId:config.idToken,
      app: this.app,
      inputs:{
        'client_id':this.configService.getGoogleWebClientId(),
        'client_secret':this.configService.getGoogleWebClientSecret(),
        'code':config.serverAuthCode,
        'grant_type':'authorization_code'
      },
      success: this.callBackToken,
      error: this.callBackError,
      context: this,
    };

    this.httpService.post(params);
  }

  private callBackToken(response: any): void {
    this.accessToken= response.access_token;
    this.idToken= response.idToken;
    console.log(response);
    this.getContacts();
  }

private getContacts(): void {

  let params = {
    url: 'https://www.google.com/m8/feeds/contacts/default/full',
    urlAltParams: {
      oauth_token:this.accessToken,
      'max-results': this.quantity,
      'start-index': this.page
    },
    type:'xml',
    bearToken:this.accessToken,
    clientId:this.idToken,
    app: this.app,
    success: this.callBackContact,
    error: this.callBackError,
    context: this,
  };

  this.httpService.get(params);

}
  private callBackContact(response: any): void {
    this.messages.closeMessage();
    this.page = this.page + this.quantity;
    if (response.feed['openSearch:totalResults'] !== undefined && response.feed['openSearch:totalResults'] !== null)
      this.maxContacts = response.feed['openSearch:totalResults'];
    for (let i in response['feed'].entry) {
      let item = response['feed'].entry[i];
      console.log(item);
      let contact = {};

      if (item['title'] !== undefined && item['title'] !== null && item['title'][0]!==undefined && item['title'][0]!==null && item['title'][0]['_']!==undefined && item['title'][0]['_']!==null){
        contact['name'] = item['title'][0]['_'];
      }else{
        contact['name'] = '';
      }

      if (item['gd:email'] !== undefined && item['gd:email'] !== null && item['gd:email'][0] !== undefined && item['gd:email'][0] !== null && item['gd:email'][0]['$'] !== undefined && item['gd:email'][0]['$'] !== null){
        let email = item['gd:email'][0]['$'];
        contact['email'] = email['address'];
      }else{
        contact['email'] = '';
      }

      contact['imageLoaded'] = true;
      contact['image_profile'] = this.sanitizer.bypassSecurityTrustStyle('url(' + this.configService.getProfileImage() + ')');
      this.listContacts.push(contact);

    }
    this.refreshScroll();
  }
/*
  private loadImage(image: any): void {
    let img = new Image();
    /// set handler and url
    img.onload = this.onloadHandler.bind({ 'image': image });
    img.onerror = this.onErrorHandler.bind({ 'image': image, 'config':this.configService, 'sanitizer':this.sanitizer });
    img.src = image.url;
  }

  private onErrorHandler(data): void {
      this['image'].imageLoaded = true;
      this['image'].image_profile = this.sanitizer.bypassSecurityTrustStyle('url('+this['config'].getProfileImage()+')');
  }

  private onloadHandler(data): void {
    if (this['image'] !== undefined)
      this['image'].imageLoaded = true;
  }
*/
  public moreContacts(infiniteScroll): void {
    console.log('moreContacts');
    this.infiniteScroll = infiniteScroll;
    if (this.page <= this.maxContacts) {
      this.getContacts();
    } else {
      this.disableScroll();
    }
  }

  public backAction(): void {
    this.tabService.setNotRefresh(false);
    console.log("back action googleplus");
    this.googlePlus.logout();
    if (this.destiny === 'add_contacts')
      this.navCtrl.pop();
  }


  public returnContact(contact:any):void{
    console.log("return contact");
    this.contactForm.controls['full_name'].patchValue(contact['name'].trim());
    this.contactForm.controls['full_name'].setValue(contact['name'].trim());

    this.contactForm.controls['email'].patchValue(contact['email'].trim());
    this.contactForm.controls['email'].setValue(contact['email'].trim());
    this.backAction();

  }

  private refreshScroll(): void {
    console.log('refreshScroll');
    if (this.infiniteScroll !== undefined)
      this.infiniteScroll.complete();
  }

  private disableScroll(): void {
    console.log("disabled");
    this.googlePlus.logout();
    if (this.infiniteScroll !== undefined)
      this.infiniteScroll.enable(false);
  }

  private callBackError(response: any): void {
    this.sent = false;
    console.error(response);
    this.googlePlus.logout();
    this.messages.closeMessage();
  }
}
