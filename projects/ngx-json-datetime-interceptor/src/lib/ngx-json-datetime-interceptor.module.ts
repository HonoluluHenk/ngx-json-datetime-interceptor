import {HTTP_INTERCEPTORS} from '@angular/common/http';
import {ModuleWithProviders, NgModule} from '@angular/core';
import {Configuration, Configurator, NgxJsonDatetimeInterceptor} from './ngx-json-datetime-interceptor';

@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: NgxJsonDatetimeInterceptor,
      multi: true,
    },
  ],
})
export class NgxJsonDatetimeInterceptorModule {
  public static using(opts: Configuration): ModuleWithProviders {
    return {
      ngModule: NgxJsonDatetimeInterceptorModule,
      providers: [
        {
          provide: Configurator,
          useValue: new Configurator(opts),
        },
      ],
    };
  }
}
