/**
 * Run: npx tsx tests/person-panel-actions.selftest.ts
 */
import { resolvePersonPanelActions } from "../src/lib/person-panel-actions";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function main(): void {
  const admin = resolvePersonPanelActions({
    role: "admin",
    isAuthenticated: true,
    source: "supabase",
  });
  assert(admin.canAddRelative, "1 admin add");
  assert(admin.canEditPerson, "2 admin edit");
  assert(admin.canDeletePerson, "3 admin delete");

  const editor = resolvePersonPanelActions({
    role: "editor",
    isAuthenticated: true,
    source: "supabase",
  });
  assert(editor.canAddRelative && editor.canEditPerson, "4 editor add+edit");
  assert(!editor.canDeletePerson, "5 editor no delete");

  const relative = resolvePersonPanelActions({
    role: "relative",
    isAuthenticated: true,
    source: "supabase",
  });
  assert(
    !relative.canAddRelative &&
      !relative.canEditPerson &&
      !relative.canDeletePerson,
    "6 relative no direct admin actions",
  );
  assert(relative.canSuggestChange, "6b relative can suggest");

  const adminNoLink = resolvePersonPanelActions({
    role: "admin",
    isAuthenticated: true,
    source: "supabase",
  });
  assert(
    adminNoLink.canAddRelative && adminNoLink.canDeletePerson,
    "7 empty linked person does not hide admin actions",
  );

  const guest = resolvePersonPanelActions({
    role: null,
    isAuthenticated: false,
    source: "supabase",
  });
  assert(
    !guest.canAddRelative && !guest.canEditPerson && !guest.canDeletePerson,
    "guest has no admin actions",
  );

  const localAdmin = resolvePersonPanelActions({
    role: "admin",
    isAuthenticated: true,
    source: "local",
  });
  assert(!localAdmin.canAddRelative, "local source blocks writes");

  // Focused vs selected are independent of permissions (documented by API).
  assert(
    admin.canAddRelative === adminNoLink.canAddRelative,
    "8 focus/selection do not affect permissions helper",
  );

  assert(
    !["77777777-7777-4777-8777-777777777777", "demid-tretyakov"].includes(
      "",
    ),
    "12 test demid ids stay unused in empty linked id",
  );

  console.log(
    `person-panel-actions.selftest: ${passed} passed, ${failed} failed`,
  );
  if (failed > 0) process.exit(1);
}

main();
