import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * CONTROLLER raiz (padrao MVC adaptado ao Angular).
 *
 * Nao tem regra de negocio: existe apenas para hospedar o <router-outlet>,
 * ou seja, para o Router ter um lugar onde desenhar a tela de cada rota.
 *
 * Os TRES arquivos do componente ficam separados, no padrao classico:
 *   app.component.ts    -> a classe (Controller)
 *   app.component.html  -> o template (View)
 *   app.component.scss  -> o estilo
 * E a mesma estrutura que todo componente do projeto segue.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
