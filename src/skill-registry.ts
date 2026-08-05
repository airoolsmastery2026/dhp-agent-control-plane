import { skillManifestSchema, type SkillManifest } from './contracts.js';

export class SkillRegistry {
  private readonly skills = new Map<string, SkillManifest>();

  register(input: unknown): SkillManifest {
    const manifest = skillManifestSchema.parse(input);
    const existing = this.skills.get(manifest.id);

    if (existing && existing.version === manifest.version) {
      throw new Error(`Skill ${manifest.id}@${manifest.version} is already registered`);
    }

    this.skills.set(manifest.id, manifest);
    return manifest;
  }

  get(skillId: string): SkillManifest | undefined {
    return this.skills.get(skillId);
  }

  require(skillId: string): SkillManifest {
    const skill = this.get(skillId);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillId}`);
    }
    return skill;
  }

  list(options: { enabledOnly?: boolean; capability?: string } = {}): SkillManifest[] {
    return [...this.skills.values()].filter((skill) => {
      if (options.enabledOnly && !skill.enabled) return false;
      if (options.capability && !skill.capabilities.includes(options.capability)) return false;
      return true;
    });
  }

  setEnabled(skillId: string, enabled: boolean): SkillManifest {
    const current = this.require(skillId);
    const updated = { ...current, enabled };
    this.skills.set(skillId, updated);
    return updated;
  }
}
