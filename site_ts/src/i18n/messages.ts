export function mapResultToMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    // login / auth
    case 'invalid_credentials': return 'Pseudo ou mot de passe invalide';
    case 'missing_fields': return 'Champs manquants';
    case 'invalid_token': return 'Session expirée — reconnectez‑vous';
    case 'login_failed': return 'Échec de la connexion';
    // register
    case 'short_username': return 'Pseudo trop court (min. 4 caractères)';
    case 'long_username': return 'Pseudo trop long (max. 10 caractères)';
    case 'invalid_username': return 'Pseudo invalide (lettres, chiffres et underscore seulement)';
    case 'username_already_exists': return 'Le pseudo existe déjà';
    case 'email_already_registered': return 'Cet e‑mail est déjà utilisé';
    case 'missing_email': return 'E‑mail requis';
    case 'short_password': return 'Mot de passe trop court (min. 8 caractères)';
    case 'long_password': return 'Mot de passe trop long (max. 32 caractères)';
    case 'invalid_password': return 'Caractères de mot de passe invalides';
    case 'invalid_email': return 'E‑mail invalide';
    case 'internal_error': return 'Erreur interne du serveur';
    case 'registration_disabled': return 'Inscription désactivée';
    case 'invalid_captcha': return 'Captcha invalide';
    case 'mismatch_password': return 'Les mots de passe ne correspondent pas';
    case 'registered_recently': return 'Vous avez déjà créé un compte récemment';
    case 'success': return 'Inscription réussie';
    default: return typeof code === 'string' ? code : null;
  }
}
