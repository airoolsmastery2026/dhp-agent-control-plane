import type { SkillManifest, SkillPermission } from './contracts.js';

export interface SkillPolicyRule {
  projectId: string;
  allowedPermissions: SkillPermission[];
  allowedSkillIds?: string[];
}

export class SkillPermissionPolicy {
  private readonly rules = new Map<string, SkillPolicyRule>();

  upsert(rule: SkillPolicyRule): void {
    this.rules.set(rule.projectId, {
      ...rule,
      allowedPermissions: [...new Set(rule.allowedPermissions)],
      allowedSkillIds: rule.allowedSkillIds
        ? [...new Set(rule.allowedSkillIds)]
        : undefined,
    });
  }

  assertAllowed(projectId: string, manifest: SkillManifest): void {
    const rule = this.rules.get(projectId);
    if (!rule) {
      throw new Error(`No skill policy configured for project: ${projectId}`);
    }

    if (rule.allowedSkillIds && !rule.allowedSkillIds.includes(manifest.id)) {
      throw new Error(`Skill is not allowed for project ${projectId}: ${manifest.id}`);
    }

    const denied = manifest.permissions.filter(
      (permission) => !rule.allowedPermissions.includes(permission),
    );

    if (denied.length > 0) {
      throw new Error(
        `Skill ${manifest.id} requests denied permissions: ${denied.join(', ')}`,
      );
    }
  }
}
