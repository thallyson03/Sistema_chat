const MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 12);

export function validatePassword(password: string): string | null {
  if (!password || typeof password !== 'string') {
    return 'Senha é obrigatória';
  }

  if (password.length < MIN_LENGTH) {
    return `Senha deve ter no mínimo ${MIN_LENGTH} caracteres`;
  }

  if (password.length > 128) {
    return 'Senha não pode exceder 128 caracteres';
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const complexity = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (complexity < 3) {
    return 'Senha deve conter pelo menos 3 dos seguintes: minúscula, maiúscula, número, caractere especial';
  }

  return null;
}
