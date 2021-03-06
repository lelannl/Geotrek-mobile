import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SettingsService } from '@app/services/settings/settings.service';
import { IonContent, ModalController } from '@ionic/angular';
import { combineLatest } from 'rxjs';
import { map, mergeMap, delay } from 'rxjs/operators';
import { Network } from '@ionic-native/network/ngx';
import { Platform } from '@ionic/angular';

import { environment } from '@env/environment';
import { UnSubscribe } from '@app/components/abstract/unsubscribe';
import { FiltersComponent } from '@app/components/filters/filters.component';
import { SearchComponent } from '@app/components/search/search.component';
import { MinimalTrek, TreksContext, TreksService } from '@app/interfaces/interfaces';
import { FilterTreksService } from '@app/services/filter-treks/filter-treks.service';
import { OnlineTreksService } from '@app/services/online-treks/online-treks.service';
import { OfflineTreksService } from '@app/services/offline-treks/offline-treks.service';
import { LoadingService } from '@app/services/loading/loading.service';

@Component({
  selector: 'app-treks',
  templateUrl: 'treks.page.html',
  styleUrls: ['treks.page.scss'],
  providers: [FilterTreksService],
})
export class TreksPage extends UnSubscribe implements OnInit {
  public noNetwork = false;
  public appName: string = environment.appName;
  public treksByStep: number = environment.treksByStep;
  public colSize = 12;
  public filteredTreks: MinimalTrek[];
  public mapLink: string;
  public nbOfflineTreks = 0;
  public numberOfActiveFilters: string;
  public offline = false;
  public currentMaxTreks: number = environment.treksByStep;
  public loaderStatus: Boolean;

  private treksTool: TreksService;
  @ViewChild('content') private content: IonContent;

  constructor(
    private filterTreks: FilterTreksService,
    public loading: LoadingService,
    private modalController: ModalController,
    public offlineTreks: OfflineTreksService,
    public onlineTreks: OnlineTreksService,
    private route: ActivatedRoute,
    private router: Router,
    private settings: SettingsService,
    private network: Network,
    public platform: Platform,
  ) {
    super();
  }

  ionViewWillEnter() {
    if (this.platform.is('ios') || this.platform.is('android')) {
      this.noNetwork = this.network.type === 'none';
    }
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.subscriptions$$.push(
      // load tools when enter route
      this.route.data.subscribe(data => {
        const context: TreksContext = data.context;
        this.treksTool = context.treksTool;
        this.mapLink = context.treksTool.getTreksMapUrl();
        this.offline = context.offline;
      }),

      // select treks when filter change or when we enter route
      combineLatest(
        this.route.data.pipe(
          map(data => data.context),
          mergeMap((context: TreksContext) => context.treksTool.filteredTreks$),
        ),
        this.filterTreks.activeFiltersNumber$,
        this.settings.data$,
      ).subscribe(([filteredTreks, numberOfActiveFilters, settings]) => {
        if (settings) {
          if (this.platform.is('ios') || this.platform.is('android')) {
            this.noNetwork = this.network.type === 'none';
          }
          this.numberOfActiveFilters = !!numberOfActiveFilters ? `(${numberOfActiveFilters})` : '';
          this.filteredTreks = <MinimalTrek[]>[...filteredTreks];
        }
      }),

      // get number of offline treks
      this.offlineTreks.treks$.subscribe(treks => {
        if (!treks) {
          this.nbOfflineTreks = 0;
        } else {
          this.nbOfflineTreks = treks.features.length;
        }
      }),
      this.loading.status.pipe(delay(0)).subscribe(status => (this.loaderStatus = status)),
    );
  }

  public expandTreks() {
    if (this.currentMaxTreks < this.filteredTreks.length) {
      if (this.currentMaxTreks + this.treksByStep > this.filteredTreks.length) {
        this.currentMaxTreks = this.filteredTreks.length;
      } else {
        this.currentMaxTreks += this.treksByStep;
      }
    } else {
      this.currentMaxTreks = this.treksByStep;
    }
  }

  public changeColSize(): void {
    this.colSize = this.colSize === 12 ? 6 : 12;
    this.content.scrollToTop();
  }

  public getMdColSize(): number {
    return this.colSize / 2;
  }

  public async presentFilters(): Promise<void> {
    const modal = await this.modalController.create({
      component: FiltersComponent,
      componentProps: { isOnline: !this.offline },
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data) {
      this.content.scrollToTop();
    }
  }

  public async presentSearch(): Promise<void> {
    const modal = await this.modalController.create({
      component: SearchComponent,
      componentProps: { isOnline: !this.offline },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data) {
      this.navigateToTrek(data);
    }
  }

  private navigateToTrek(id: number) {
    this.router.navigate([this.treksTool.getTrekDetailsUrl(id)]);
  }

  public resetFilters() {
    this.settings.resetFilters();
  }

  public trackTrek(index: number, element: MinimalTrek): number | null {
    return element ? element.properties.id : null;
  }
}
