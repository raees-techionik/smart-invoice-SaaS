import {
  resetTeamUserPassword,
  updateTeamUser,
} from "@/app/dashboard/settings/actions";
import { AssetUploadForm } from "@/app/_frontend/components/settings/asset-upload-form";
import { BusinessSettingsForm } from "@/app/_frontend/components/settings/business-settings-form";
import { EmailSettingsForm } from "@/app/_frontend/components/settings/email-settings-form";
import { EmailTestForm } from "@/app/_frontend/components/settings/email-test-form";
import { TeamUserForm } from "@/app/_frontend/components/settings/team-user-form";
import { canManageTeam, requireSettingsManager } from "@/app/_backend/lib/auth/roles";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { hasCompleteEmailSettings } from "@/app/_backend/lib/email-settings";

function dateFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function AssetPath({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/55 px-3 py-2.5 shadow-[0_8px_18px_rgba(36,42,94,0.05)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[220px] truncate font-semibold">
        {value || "Not uploaded"}
      </dd>
    </div>
  );
}

function PremiumVisual() {
  return (
    <div className="premium-visual hidden xl:block" aria-hidden="true">
      <div className="premium-visual-rig">
        <div className="premium-visual-floor" />
        <div className="premium-visual-sheet" />
        <div className="premium-visual-cube" />
        <div className="premium-visual-coin">SE</div>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireSettingsManager();
  const canEditTeam = canManageTeam(user.role);

  const [teamUsers, emailSetting] = await Promise.all([
    canEditTeam
      ? prisma.user.findMany({
          orderBy: [
            {
              role: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          where: {
            businessId: user.businessId,
          },
        })
      : Promise.resolve([]),
    prisma.businessEmailSetting.findUnique({
      where: {
        businessId: user.businessId,
      },
    }),
  ]);
  const canTestEmail = hasCompleteEmailSettings(emailSetting);

  return (
    <div className="relative grid gap-3.5">
      <PremiumVisual />
      <header className="premium-card relative z-[1] grid gap-4 overflow-hidden rounded-[16px] border p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#635bff]">
            Settings
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
            Business setup and access
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Keep invoice defaults, profile assets, and team access aligned
            before adding the next business modules.
          </p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/65 px-4 py-3 shadow-[0_12px_28px_rgba(36,42,94,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Access level
          </p>
          <p className="mt-1 text-lg font-semibold capitalize">{user.role}</p>
        </div>
      </header>

      <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="premium-card rounded-[16px] border p-5">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
              Business profile
            </p>
            <h3 className="mt-1 text-[13px] font-medium">
              Invoice and company defaults
            </h3>
          </div>
          <BusinessSettingsForm
            defaults={{
              address: user.business.address ?? "",
              category: user.business.category ?? "",
              currency: user.business.currency,
              defaultNotes: user.business.defaultNotes ?? "",
              defaultTerms: user.business.defaultTerms ?? "",
              email: user.business.email ?? "",
              invoicePrefix: user.business.invoicePrefix,
              name: user.business.name,
              ownerName: user.business.ownerName ?? user.name,
              phone: user.business.phone ?? "",
              taxNumber: user.business.taxNumber ?? "",
            }}
          />
        </div>

        <div className="grid gap-3.5 content-start">
          <div className="premium-card rounded-[16px] border p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00a884]">
                Profile assets
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Logo, signature, and stamp
              </h3>
            </div>
            <AssetUploadForm />
          </div>

          <div className="premium-card rounded-[16px] border p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
              Current files
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <AssetPath label="Logo" value={user.business.logoPath} />
              <AssetPath
                label="Signature"
                value={user.business.signaturePath}
              />
              <AssetPath label="Stamp" value={user.business.stampPath} />
            </dl>
          </div>
        </div>
      </section>

      <section className="premium-card relative z-[1] rounded-[16px] border p-5">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
            Email delivery
          </p>
          <h3 className="mt-1 text-[13px] font-medium">
            SMTP settings for sending invoices
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            These settings are used when prepared invoice emails are sent. The
            password is encrypted and never shown again after saving.
          </p>
        </div>
        <EmailSettingsForm
          defaults={{
            fromEmail: emailSetting?.fromEmail ?? user.business.email ?? "",
            fromName: emailSetting?.fromName ?? user.business.name,
            hasPassword: Boolean(emailSetting?.smtpPasswordEncrypted),
            replyToEmail: emailSetting?.replyToEmail ?? "",
            smtpHost: emailSetting?.smtpHost ?? "",
            smtpPort: String(emailSetting?.smtpPort ?? 587),
            smtpSecure: emailSetting?.smtpSecure ?? false,
            smtpUsername: emailSetting?.smtpUsername ?? "",
          }}
        />
        <div className="mt-5">
          <EmailTestForm
            canTest={canTestEmail}
            defaultRecipientEmail={user.email}
          />
        </div>
      </section>

      {canEditTeam ? (
        <section className="relative z-[1] grid gap-3.5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="premium-card rounded-[16px] border p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00a884]">
                New user
              </p>
              <h3 className="mt-1 text-[13px] font-medium">
                Add admin or staff access
              </h3>
            </div>
            <TeamUserForm />
          </div>

          <div className="premium-card overflow-hidden rounded-[16px] border">
            <div className="flex flex-col gap-2 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635bff]">
                  Team access
                </p>
                <h3 className="mt-1 text-[13px] font-medium">
                  Roles and status
                </h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {teamUsers.length} users
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-white/45 text-[11px] uppercase tracking-[0.08em] text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 font-semibold">Save</th>
                    <th className="px-5 py-3 font-semibold">Password reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {teamUsers.map((teamUser) => {
                    const isOwner = teamUser.role === "owner";

                    return (
                      <tr className="transition hover:bg-white/45" key={teamUser.id}>
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold">{teamUser.name}</p>
                          <p className="mt-1 text-muted-foreground">
                            {teamUser.email}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top capitalize">
                          {isOwner ? (
                            <span className="rounded-sm bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                              Owner
                            </span>
                          ) : (
                            <form action={updateTeamUser} id={teamUser.id}>
                              <input
                                name="userId"
                                type="hidden"
                                value={teamUser.id}
                              />
                              <select
                                className="h-10 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
                                defaultValue={teamUser.role}
                                name="role"
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </form>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {isOwner ? (
                            <span className="rounded-sm bg-muted px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">
                              {teamUser.status}
                            </span>
                          ) : (
                            <select
                              className="h-10 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
                              defaultValue={teamUser.status}
                              form={teamUser.id}
                              name="status"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-muted-foreground">
                          {dateFormatter(teamUser.createdAt)}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {isOwner ? (
                            <span className="text-sm text-muted-foreground">
                              Protected
                            </span>
                          ) : (
                            <button
                              className="premium-button h-10 rounded-lg px-3 text-sm font-semibold text-white transition"
                              form={teamUser.id}
                              type="submit"
                            >
                              Save
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {isOwner ? (
                            <span className="text-sm text-muted-foreground">
                              Protected
                            </span>
                          ) : (
                            <form
                              action={resetTeamUserPassword}
                              className="flex gap-2"
                            >
                              <input
                                name="userId"
                                type="hidden"
                                value={teamUser.id}
                              />
                              <input
                                className="h-10 w-40 rounded-lg border border-white/80 bg-white/70 px-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-[#635bff]/40 focus:ring-2 focus:ring-[#635bff]/10"
                                minLength={8}
                                name="password"
                                placeholder="New password"
                                required
                                type="password"
                              />
                              <button
                                className="premium-soft-button h-10 rounded-lg border px-3 text-sm font-semibold transition hover:border-[#635bff]/30 hover:bg-white"
                                type="submit"
                              >
                                Reset
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="premium-card relative z-[1] rounded-[16px] border p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">
            Team management
          </p>
          <h3 className="mt-1 text-[13px] font-medium">Owner-only access</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Admins can update business settings and upload invoice assets.
            Creating users or changing roles is reserved for the owner account.
          </p>
        </section>
      )}
    </div>
  );
}
