"use client";

import {
  CalendarDays,
  Camera,
  ImageOff,
  MapPin,
  Pencil,
  PencilLine,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { SuggestChangeDialog } from "@/components/collaboration/SuggestChangeDialog";
import { AddRelativeDialog } from "@/components/family/AddRelativeDialog";
import { DeletePersonDialog } from "@/components/family/DeletePersonDialog";
import { EditPersonDialog } from "@/components/family/EditPersonDialog";
import { PersonPhotoDialog } from "@/components/family/PersonPhotoDialog";
import { PhotoDeleteDialog } from "@/components/family/PhotoDeleteDialog";
import { useAuth } from "@/context/AuthContext";
import { useFamilyData } from "@/context/FamilyDataContext";
import {
  formatBirthDate,
  formatLifeYears,
  getFullName,
} from "@/data/family";
import { getAvatarPalette, getInitials } from "@/lib/avatar";
import {
  resolvePersonPhotoUrl,
  usePersonPhotoUrls,
} from "@/hooks/usePersonPhotoUrls";
import { resolvePersonPanelActions } from "@/lib/person-panel-actions";
import {
  buildPersonIndex,
  getSiblingIds,
} from "@/lib/tree-visibility";
import { resolveRelationToFocus } from "@/lib/relation-to-focus";
import type { Person } from "@/types/family";

interface PersonDetailsProps {
  person: Person;
  people: Person[];
  focusedPersonId?: string | null;
  onClose: () => void;
  onSelectRelative: (personId: string) => void;
  onOpenFullProfile?: (personId: string) => void;
  onRelativeCreated?: (personId: string) => void;
  onPersonUpdated?: (personId: string) => void;
  onPersonDeleted?: (nextFocusPersonId: string | null) => void;
  onMakeCenter?: (personId: string) => void;
  isFocusedCenter?: boolean;
  variant?: "sidebar" | "sheet" | "modal";
  /** When false, hide «Открыть профиль» (already inside full profile). */
  showOpenProfileButton?: boolean;
}

function RelativeLink({
  person,
  label,
  onSelect,
}: {
  person: Person;
  label: string;
  onSelect: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      className="rounded-2xl border border-[var(--heritage-branch,#E4DDD1)]/35 bg-[var(--heritage-surface,#FAF7F1)] px-3 py-2.5 text-left text-sm text-[var(--heritage-text,#2D4A3E)] shadow-[0_2px_10px_var(--heritage-shadow,rgba(45,74,62,0.06))] transition hover:border-[var(--heritage-gold,#C4A962)]"
    >
      <span className="block font-medium">{getFullName(person)}</span>
      <span className="mt-0.5 block text-xs text-[var(--heritage-muted,#6B776F)]">
        {label}
      </span>
    </button>
  );
}

function spouseRelationLabel(person: Person, relativeId: string): string {
  const link = person.spouseLinks?.find((item) => item.spouseId === relativeId);
  if (link?.status === "former") return "Бывший супруг(а)";
  if (link?.status === "unknown") return "Супруг(а)";
  return "Супруг(а)";
}

function parentRelationLabel(person: Person, parentId: string): string {
  const link = person.parentLinks?.find((item) => item.parentId === parentId);
  if (link?.kind === "adoptive") return "Усыновление / удочерение";
  if (link?.kind === "step") return "Отчим / мачеха";
  if (link?.kind === "guardian") return "Опека";
  return "Родной родитель";
}

export function PersonDetails({
  person,
  people,
  focusedPersonId = null,
  onClose,
  onSelectRelative,
  onOpenFullProfile,
  onRelativeCreated,
  onPersonUpdated,
  onPersonDeleted,
  onMakeCenter,
  isFocusedCenter = false,
  variant = "sidebar",
  showOpenProfileButton = true,
}: PersonDetailsProps) {
  const {
    user,
    authenticatedRole,
  } = useAuth();
  const { source, reload } = useFamilyData();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isPhotoDeleteOpen, setIsPhotoDeleteOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  const panelActions = resolvePersonPanelActions({
    role: authenticatedRole,
    isAuthenticated: Boolean(user),
    source,
  });
  const canDelete = panelActions.canDeletePerson;
  const canSuggest = panelActions.canSuggestChange;
  const canChangePhoto = panelActions.canChangePhoto;

  const { urlsByPath, isLoading: isPhotoLoading } = usePersonPhotoUrls([
    person.photoPath,
  ]);
  const centerRelation =
    focusedPersonId && focusedPersonId !== person.id
      ? resolveRelationToFocus({
          focusId: focusedPersonId,
          personId: person.id,
          people,
        })
      : focusedPersonId === person.id
        ? resolveRelationToFocus({
            focusId: person.id,
            personId: person.id,
            people,
          })
        : null;
  const signedUrl = resolvePersonPhotoUrl(person.photoPath, urlsByPath);
  const showPhoto = Boolean(signedUrl) && !photoFailed && Boolean(user);

  const palette = getAvatarPalette(person.id);
  const initials = getInitials(
    person.firstName,
    person.lastName || person.middleName || "",
  );
  const peopleById = new Map(people.map((item) => [item.id, item]));
  const personIndex = buildPersonIndex(people);
  const parents = person.parentIds
    .map((parentId) => peopleById.get(parentId))
    .filter((item): item is Person => Boolean(item));
  const spouseIds = [
    ...(person.spouseIds && person.spouseIds.length > 0
      ? person.spouseIds
      : person.spouseId
        ? [person.spouseId]
        : []),
  ];
  const spouses = spouseIds
    .map((spouseId) => peopleById.get(spouseId))
    .filter((item): item is Person => Boolean(item));
  const children = person.childIds
    .map((childId) => peopleById.get(childId))
    .filter((item): item is Person => Boolean(item));
  const siblings = getSiblingIds(person.id, personIndex)
    .map((siblingId) => peopleById.get(siblingId))
    .filter((item): item is Person => Boolean(item));
  const lifeYears = formatLifeYears(person);

  useEffect(() => {
    setPhotoFailed(false);
  }, [person.id, person.photoPath]);

  const actionButtonClassName =
    "nodrag nopan flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]";

  const handleOpenFullProfile = (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    onOpenFullProfile?.(person.id);
  };

  return (
    <div
      className={
        variant === "sidebar"
          ? "flex h-full flex-col bg-[var(--heritage-surface,#FFFCF8)]"
          : variant === "modal"
            ? "flex flex-col bg-[var(--heritage-surface,#FFFCF8)]"
            : "flex flex-col px-4 pt-2 pb-2"
      }
    >
      {variant === "sidebar" ? (
        <div className="flex items-center justify-between border-b border-[#EDE8DF] px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--heritage-green,#1B4332)]">
            Профиль
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--heritage-green,#2D4A3E)] transition hover:bg-[#F3EEE4]"
            aria-label="Закрыть панель"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      <div
        className={
          variant === "sidebar"
            ? "min-h-0 flex-1 overflow-y-auto px-5 py-5"
            : variant === "modal"
              ? "overflow-y-auto px-5 py-5"
              : "overflow-y-auto px-1 py-2"
        }
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="relative mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--heritage-gold,#C4A962)]/55 shadow-[0_8px_24px_var(--heritage-shadow,rgba(45,74,62,0.12))]"
            style={{
              backgroundImage: `linear-gradient(145deg, ${palette.from}, ${palette.to})`,
            }}
          >
            {isPhotoLoading && person.photoPath && user ? (
              <span className="absolute inset-0 animate-pulse bg-[#E8DFD0]/70" />
            ) : null}
            {showPhoto && signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrl}
                alt={getFullName(person)}
                className="h-full w-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span
                className="text-3xl font-semibold tracking-wide"
                style={{ color: palette.foreground }}
              >
                {initials}
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-[var(--heritage-text,#1B4332)]">
            {getFullName(person)}
          </h3>
          {person.maidenName ? (
            <p className="mt-1 text-sm text-[var(--heritage-muted,#6B776F)]">
              Урожд. {person.maidenName}
            </p>
          ) : null}
          {lifeYears ? (
            <p className="mt-1 text-sm text-[var(--heritage-muted,#6B776F)]">
              {lifeYears}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--heritage-muted,#6B776F)]">
            {person.relationshipLabel}
          </p>
          {centerRelation ? (
            <div className="mt-3 w-full rounded-xl border border-[#E8E0D4] bg-[#FAF6EF] px-3 py-2 text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A7A55]">
                Связь с центром дерева
              </p>
              <p className="mt-1 text-sm font-medium text-[#1B4332]">
                {centerRelation.label}
              </p>
              {centerRelation.chainLabel &&
              centerRelation.chainLabel !== centerRelation.label ? (
                <p className="mt-0.5 text-xs text-[#5A6B62]">
                  {centerRelation.chainLabel}
                </p>
              ) : null}
            </div>
          ) : null}
          {onMakeCenter ? (
            isFocusedCenter ? (
              <p className="mt-3 text-sm font-medium text-[var(--heritage-green-soft,#5C6B63)]">
                Центр дерева
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onMakeCenter(person.id)}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#D9D0C3] bg-[var(--heritage-surface,#FFFCF7)] px-3 text-sm font-medium text-[var(--heritage-green,#2D4A3E)] transition hover:border-[var(--heritage-gold,#C4A962)]"
              >
                Сделать центром
              </button>
            )
          ) : null}

          {canChangePhoto ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPhotoOpen(true);
                }}
                className="nodrag nopan inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] hover:border-[#C4A962]"
                aria-label={
                  person.photoPath
                    ? "Изменить фотографию"
                    : "Добавить фотографию"
                }
              >
                <Camera className="h-4 w-4" />
                {person.photoPath
                  ? "Изменить фотографию"
                  : "Добавить фотографию"}
              </button>
              {person.photoPath ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsPhotoDeleteOpen(true);
                  }}
                  className="nodrag nopan inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E4C7C0] bg-[#FBF6F4] px-3 text-sm font-medium text-[#7A3E32] hover:border-[#C9897C]"
                  aria-label="Удалить фотографию"
                >
                  <ImageOff className="h-4 w-4" />
                  Удалить фото
                </button>
              ) : null}
            </div>
          ) : null}

          {photoWarning ? (
            <p className="mt-2 max-w-sm text-xs text-[#7A3E32]">{photoWarning}</p>
          ) : null}
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-[#E4DDD1] bg-[#FAF7F1] p-4 shadow-[0_2px_12px_var(--heritage-shadow,rgba(45,74,62,0.06))]">
            <div className="flex items-start gap-3 text-sm text-[var(--heritage-text,#2D4A3E)]">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--heritage-gold,#C4A962)]" />
              <div>
                <p className="font-medium">Дата рождения</p>
                <p className="mt-1 text-[var(--heritage-muted,#5C6B63)]">
                  {formatBirthDate(person.birthDate)}
                </p>
              </div>
            </div>
            {person.birthPlace ? (
              <div className="mt-4 flex items-start gap-3 border-t border-[#EDE8DF] pt-4 text-sm text-[var(--heritage-text,#2D4A3E)]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--heritage-gold,#C4A962)]" />
                <div>
                  <p className="font-medium">Место рождения</p>
                  <p className="mt-1 text-[var(--heritage-muted,#5C6B63)]">
                    {person.birthPlace}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {parents.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--heritage-green,#1B4332)]">
                Родители
              </h4>
              <div className="grid gap-2">
                {parents.map((parent) => (
                  <RelativeLink
                    key={parent.id}
                    person={parent}
                    label={parentRelationLabel(person, parent.id)}
                    onSelect={onSelectRelative}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {spouses.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--heritage-green,#1B4332)]">
                Супруги
              </h4>
              <div className="grid gap-2">
                {spouses.map((spouse) => (
                  <RelativeLink
                    key={spouse.id}
                    person={spouse}
                    label={spouseRelationLabel(person, spouse.id)}
                    onSelect={onSelectRelative}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {children.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--heritage-green,#1B4332)]">
                Дети
              </h4>
              <div className="grid gap-2">
                {children.map((child) => (
                  <RelativeLink
                    key={child.id}
                    person={child}
                    label="Ребёнок"
                    onSelect={onSelectRelative}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {siblings.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--heritage-green,#1B4332)]">
                Братья и сёстры
              </h4>
              <div className="grid gap-2">
                {siblings.map((sibling) => (
                  <RelativeLink
                    key={sibling.id}
                    person={sibling}
                    label="Брат / сестра"
                    onSelect={onSelectRelative}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {person.biography ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--heritage-green,#1B4332)]">
                Биография
              </h4>
              <p className="rounded-2xl border border-[#E4DDD1] bg-[#FAF7F1] p-4 text-sm leading-6 text-[var(--heritage-muted,#5C6B63)]">
                {person.biography}
              </p>
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 mt-6 grid gap-2 border-t border-[#EDE8DF] bg-[var(--heritage-surface,#FFFCF8)]/95 py-3 backdrop-blur-sm">
          {panelActions.canAddRelative ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsAddOpen(true);
              }}
              className={`${actionButtonClassName} border-[#2D4A3E] bg-[#2D4A3E] text-[#F5F0E8] hover:bg-[#1B4332]`}
              aria-label={`Добавить родственника к ${getFullName(person)}`}
            >
              <UserPlus className="h-4 w-4" />
              Добавить родственника
            </button>
          ) : null}

          {panelActions.canEditPerson ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsEditOpen(true);
              }}
              className={`${actionButtonClassName} border-[#D9D0C3] bg-[#FFFCF7] text-[#2D4A3E] hover:border-[#C4A962]`}
              aria-label={`Редактировать ${getFullName(person)}`}
            >
              <Pencil className="h-4 w-4" />
              Редактировать
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsDeleteOpen(true);
              }}
              className={`${actionButtonClassName} border-[#E4C7C0] bg-[#FBF6F4] text-[#7A3E32] hover:border-[#C9897C]`}
              aria-label={`Удалить человека ${getFullName(person)}`}
            >
              <Trash2 className="h-4 w-4" />
              Удалить человека
            </button>
          ) : null}

          {canSuggest ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsSuggestOpen(true);
              }}
              className={`${actionButtonClassName} border-[#D9D0C3] bg-[#FFFCF7] text-[#2D4A3E] hover:border-[#C4A962]`}
            >
              <PencilLine className="h-4 w-4" />
              Предложить изменение
            </button>
          ) : null}

          {showOpenProfileButton && onOpenFullProfile ? (
            <button
              type="button"
              onClick={handleOpenFullProfile}
              className={`${actionButtonClassName} border-[#D9D0C3] bg-[#FAF7F1] text-[#2D4A3E] hover:border-[#C4A962]`}
              aria-label={`Открыть полный профиль: ${getFullName(person)}`}
              data-person-id={person.id}
              data-action="open-full-profile"
            >
              Открыть профиль
            </button>
          ) : null}
        </div>
      </div>

      <AddRelativeDialog
        isOpen={isAddOpen}
        person={person}
        onClose={() => setIsAddOpen(false)}
        onCreated={(personId) => {
          onRelativeCreated?.(personId);
        }}
      />

      <EditPersonDialog
        isOpen={isEditOpen}
        person={person}
        onClose={() => setIsEditOpen(false)}
        onSaved={(personId) => {
          onPersonUpdated?.(personId);
        }}
      />

      <DeletePersonDialog
        isOpen={isDeleteOpen}
        person={person}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={(nextFocusPersonId) => {
          onPersonDeleted?.(nextFocusPersonId);
        }}
      />

      <PersonPhotoDialog
        isOpen={isPhotoOpen}
        person={person}
        onClose={() => setIsPhotoOpen(false)}
        onSaved={async (warning) => {
          setPhotoWarning(warning ?? null);
          await reload();
          onPersonUpdated?.(person.id);
        }}
      />

      <PhotoDeleteDialog
        isOpen={isPhotoDeleteOpen}
        person={person}
        onClose={() => setIsPhotoDeleteOpen(false)}
        onDeleted={async (warning) => {
          setPhotoWarning(warning ?? null);
          await reload();
          onPersonUpdated?.(person.id);
        }}
      />

      <SuggestChangeDialog
        isOpen={isSuggestOpen}
        person={person}
        people={people}
        onClose={() => setIsSuggestOpen(false)}
        onSubmitted={() => setIsSuggestOpen(false)}
      />
    </div>
  );
}
