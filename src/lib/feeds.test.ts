import { describe, it, expect } from 'vitest';

// ------------------------------------------------------------
// Business Logic Helpers for Feeds
// ------------------------------------------------------------

export function validateFeedContent(conteudo: string): string | null {
  if (!conteudo || !conteudo.trim()) {
    return 'O conteúdo do post é obrigatório';
  }
  if (conteudo.length > 10000) {
    return 'O conteúdo excede o limite de 10.000 caracteres';
  }
  return null;
}

export function validateFeedMentions(mencoes: string[]): string | null {
  if (mencoes.length > 10) {
    return 'O post excede o limite de 10 menções';
  }
  return null;
}

export function extractHashtags(conteudo: string): string[] {
  const hashtagRegex = /#([\wÀ-ÿ]+)/g;
  const extractedTags: string[] = [];
  let match;
  while ((match = hashtagRegex.exec(conteudo)) !== null) {
    const tagClean = match[1].toLowerCase();
    if (!extractedTags.includes(tagClean)) {
      extractedTags.push(tagClean);
    }
  }
  return extractedTags;
}

export function canEditPost(autorId: string, profileId: string, tipo: string, criadoEm: string): boolean {
  if (tipo === 'sistema') return false;
  if (autorId !== profileId) return false;
  
  const createdTime = new Date(criadoEm).getTime();
  const diffMinutes = (Date.now() - createdTime) / 60000;
  return diffMinutes <= 15;
}

export function isValidReaction(tipo: string): boolean {
  const VALID_REACTIONS = ['curtir', 'amei', 'parabens', 'importante', 'risada'];
  return VALID_REACTIONS.includes(tipo);
}

// ------------------------------------------------------------
// Unit Tests
// ------------------------------------------------------------

describe('Feeds Business Logic and Rules', () => {
  describe('Content Length Validation', () => {
    it('should reject empty or whitespace-only content', () => {
      expect(validateFeedContent('')).toBe('O conteúdo do post é obrigatório');
      expect(validateFeedContent('   ')).toBe('O conteúdo do post é obrigatório');
    });

    it('should accept valid content length', () => {
      expect(validateFeedContent('Esta é uma postagem válida da equipe!')).toBeNull();
    });

    it('should reject content that exceeds 10,000 characters', () => {
      const veryLongContent = 'a'.repeat(10001);
      expect(validateFeedContent(veryLongContent)).toBe('O conteúdo excede o limite de 10.000 caracteres');
    });
  });

  describe('Mentions Count Limit', () => {
    it('should accept up to 10 mentions', () => {
      const mentions = Array(10).fill('user_uuid');
      expect(validateFeedMentions(mentions)).toBeNull();
    });

    it('should reject more than 10 mentions to prevent spam', () => {
      const mentions = Array(11).fill('user_uuid');
      expect(validateFeedMentions(mentions)).toBe('O post excede o limite de 10 menções');
    });
  });

  describe('Hashtags Extraction', () => {
    it('should extract hashtags cleanly from text', () => {
      const text = 'Olá equipe! Nova meta atingida para a #campanha de vendas. Obrigado a todos #sucesso #CRM';
      expect(extractHashtags(text)).toEqual(['campanha', 'sucesso', 'crm']);
    });

    it('should return empty array if no tags exist', () => {
      expect(extractHashtags('Sem tags aqui neste post.')).toEqual([]);
    });

    it('should support portuguese accents inside tags', () => {
      expect(extractHashtags('Alcançamos a nossa #evolução')).toEqual(['evolução']);
    });
  });

  describe('Reaction Emojis validation', () => {
    it('should approve valid reactions from the spec', () => {
      expect(isValidReaction('curtir')).toBe(true);
      expect(isValidReaction('amei')).toBe(true);
      expect(isValidReaction('risada')).toBe(true);
    });

    it('should reject invalid reaction names', () => {
      expect(isValidReaction('like')).toBe(false);
      expect(isValidReaction('love')).toBe(false);
      expect(isValidReaction('risos')).toBe(false);
      expect(isValidReaction('👍')).toBe(false);
    });
  });

  describe('15-Minute Edit Restriction', () => {
    it('should deny editing system posts', () => {
      const criadoEm = new Date().toISOString();
      expect(canEditPost('prof_1', 'prof_1', 'sistema', criadoEm)).toBe(false);
    });

    it('should deny editing other users posts', () => {
      const criadoEm = new Date().toISOString();
      expect(canEditPost('prof_1', 'prof_2', 'manual', criadoEm)).toBe(false);
    });

    it('should allow editing own manual post within 15 minutes', () => {
      const criadoEm = new Date(Date.now() - 5 * 60000).toISOString(); // 5 min ago
      expect(canEditPost('prof_1', 'prof_1', 'manual', criadoEm)).toBe(true);
    });

    it('should deny editing own manual post after 15 minutes', () => {
      const criadoEm = new Date(Date.now() - 16 * 60000).toISOString(); // 16 min ago
      expect(canEditPost('prof_1', 'prof_1', 'manual', criadoEm)).toBe(false);
    });
  });
});
