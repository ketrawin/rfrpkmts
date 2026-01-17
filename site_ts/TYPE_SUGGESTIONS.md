# Suggestions de typage pour `site_ts`

Ce fichier liste les occurrences identifiées de `any` dans `site_ts` et propose un type ou une action recommandée pour chaque cas.

---

- **Fichier**: `site_ts/src/util/Util.ts`
  - **Occurrence**: `(drawRoundedRect as any)[tmpKey]`
  - **Contexte**: on indexe une fonction/objet dynamique pour stocker des canvas temporaires.
  - **Suggestion**: Définir un type pour `drawRoundedRect` et la map associée, p.ex. `type DrawRoundedRect = (ctx: CanvasRenderingContext2D, ...args: any[]) => HTMLCanvasElement & { ctx?: CanvasRenderingContext2D }` et remplacer le `as any` par `as unknown as Record<string, DrawRoundedRect>` ou exporter l'API correctement.

- **Fichier**: `site_ts/src/ui/UI.ts`
  - **Occurrence**: plusieurs usages de `(window as any)....` pour accéder à des singletons globaux (ex: `TitleScreen`).
  - **Suggestion**: Créer une déclaration globale `declare global { interface Window { TitleScreen?: TitleScreenType; API_BASE?: string; } }` dans `src/types/global.d.ts` et typer `TitleScreenType` (ou exporter une interface depuis `screens/TitleScreen.ts`).

- **Fichier**: `site_ts/src/screens/TitleScreen.ts`
  - **Occurrences**:
    - `(window as any).__lastRegister`
    - `this.socket.on('login_result', (data: any) => { ... })`
    - `(this as any)._enterHook = onEnter;`
    - `ctx.drawImage((window as any).TitleScreen?.titleLogo?.obj || document.createElement('canvas'), ...)`
    - `let j: any = null;` (parsing réponse API)
  - **Suggestions**:
    - Étendre `Window` pour inclure `__lastRegister`, `TitleScreen`, `API_BASE` (voir ci-dessus).
    - Typiser le payload de l'événement socket `login_result`. Ajouter une interface `LoginResult { success: boolean; userId?: string; message?: string; ... }` et changer le callback en `(data: LoginResult) => {}`.
    - Remplacer `(this as any)._enterHook` par une propriété optionnelle typée dans la classe `TitleScreen`: `private _enterHook?: () => void`.
    - Typiser `j` selon la réponse attendue (p.ex. `RegisterPayload | null`) ou utiliser `unknown` + validation.

- **Fichier**: `site_ts/src/ui/UI.ts` (autres comments)
  - **Occurrence**: mentions génériques de `any` dans les commentaires et logique (p.ex. "any enabled button").
  - **Suggestion**: pas d'action urgente pour les commentaires, mais vérifier les types des boutons et des contrôles UI (définir `UIControl`/`Button` interfaces).

---

Recommandations globales :

- Créer `site_ts/src/types/global.d.ts` pour les extensions de `Window` et types partagés (socket payloads, structures de réponses API).
- Préférer `unknown` plutôt que `any` pour les données venant de l'extérieur, puis valider/convertir avant usage.
- Pour les singletons attachés à `window`, ajouter un petit fichier `src/globals.ts` qui expose des getters typés, puis les utiliser partout.
- Optionnel : ajouter `skipLibCheck: true` temporairement si des types externes posent problème, puis lever la passe au fur et à mesure.

Si vous voulez, je peux :

- A) appliquer automatiquement les conversions les plus sûres (ex : ajouter `src/types/global.d.ts` et remplacer tous les `(window as any)` par `window.` typé), ou
- B) ouvrir une PR (ou créer un patch) modifiant fichiers individuellement en montrant les diffs pour revue.

Dites quelle option vous préférez et j'appliquerai les changements.
