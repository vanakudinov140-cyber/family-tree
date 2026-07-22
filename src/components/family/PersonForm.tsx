"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Gender, RelationKind } from "@/lib/supabase/types";
import type { Person } from "@/types/family";
import { getFullName } from "@/data/family";

export const personFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Имя обязательно"),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    maidenName: z.string().trim().optional(),
    gender: z.enum(["male", "female", "other", "unknown"], {
      message: "Укажите пол",
    }),
    birthDate: z.string().optional(),
    birthYear: z.string().optional(),
    deathDate: z.string().optional(),
    deathYear: z.string().optional(),
    birthPlace: z.string().trim().optional(),
    biography: z.string().trim().optional(),
    isLiving: z.boolean(),
    secondParentId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const birthYear = values.birthYear?.trim()
      ? Number(values.birthYear)
      : null;
    const deathYear = values.deathYear?.trim()
      ? Number(values.deathYear)
      : null;

    if (values.birthYear?.trim() && Number.isNaN(birthYear)) {
      ctx.addIssue({
        code: "custom",
        path: ["birthYear"],
        message: "Год рождения должен быть числом",
      });
    }

    if (values.deathYear?.trim() && Number.isNaN(deathYear)) {
      ctx.addIssue({
        code: "custom",
        path: ["deathYear"],
        message: "Год смерти должен быть числом",
      });
    }

    if (
      birthYear !== null &&
      !Number.isNaN(birthYear) &&
      (birthYear < 1000 || birthYear > 2100)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["birthYear"],
        message: "Год рождения указан некорректно",
      });
    }

    if (
      deathYear !== null &&
      !Number.isNaN(deathYear) &&
      (deathYear < 1000 || deathYear > 2100)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deathYear"],
        message: "Год смерти указан некорректно",
      });
    }

    if (values.birthDate && birthYear !== null) {
      const yearFromDate = Number(values.birthDate.slice(0, 4));
      if (yearFromDate !== birthYear) {
        ctx.addIssue({
          code: "custom",
          path: ["birthYear"],
          message: "Год рождения не совпадает с датой рождения",
        });
      }
    }

    if (values.deathDate && deathYear !== null) {
      const yearFromDate = Number(values.deathDate.slice(0, 4));
      if (yearFromDate !== deathYear) {
        ctx.addIssue({
          code: "custom",
          path: ["deathYear"],
          message: "Год смерти не совпадает с датой смерти",
        });
      }
    }

    if (
      values.birthDate &&
      values.deathDate &&
      values.deathDate < values.birthDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deathDate"],
        message: "Дата смерти не может быть раньше даты рождения",
      });
    }

    if (
      birthYear !== null &&
      deathYear !== null &&
      !Number.isNaN(birthYear) &&
      !Number.isNaN(deathYear) &&
      deathYear < birthYear
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deathYear"],
        message: "Год смерти не может быть раньше года рождения",
      });
    }
  });

export type PersonFormValues = z.infer<typeof personFormSchema>;

export interface PersonFormSubmitPayload {
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  maiden_name: string | null;
  gender: Gender;
  birth_date: string | null;
  birth_year: number | null;
  death_date: string | null;
  death_year: number | null;
  birth_place: string | null;
  biography: string | null;
  is_living: boolean;
  secondParentId: string | null;
}

export function personToFormValues(person: Person): PersonFormValues {
  return {
    firstName: person.firstName,
    middleName: person.middleName ?? "",
    lastName: person.lastName ?? "",
    maidenName: person.maidenName ?? "",
    gender: person.gender ?? "unknown",
    birthDate: person.birthDate ?? "",
    birthYear:
      person.birthYear !== undefined && person.birthYear !== null
        ? String(person.birthYear)
        : "",
    deathDate: person.deathDate ?? "",
    deathYear:
      person.deathYear !== undefined && person.deathYear !== null
        ? String(person.deathYear)
        : "",
    birthPlace: person.birthPlace ?? "",
    biography: person.biography ?? "",
    isLiving: person.isLiving ?? (!person.deathDate && !person.deathYear),
    secondParentId: "",
  };
}

export function valuesToPersonPayload(
  values: PersonFormValues,
): PersonFormSubmitPayload {
  const birthYear = values.birthYear?.trim()
    ? Number(values.birthYear)
    : null;
  const deathYearValue = values.deathYear?.trim()
    ? Number(values.deathYear)
    : null;

  return {
    first_name: values.firstName.trim(),
    middle_name: values.middleName?.trim() || null,
    last_name: values.lastName?.trim() || null,
    maiden_name: values.maidenName?.trim() || null,
    gender: values.gender,
    birth_date: values.birthDate || null,
    birth_year: birthYear,
    death_date: values.deathDate || null,
    death_year: deathYearValue,
    birth_place: values.birthPlace?.trim() || null,
    biography: values.biography?.trim() || null,
    is_living:
      values.deathDate || values.deathYear?.trim()
        ? false
        : values.isLiving,
    secondParentId: values.secondParentId || null,
  };
}

interface PersonFormProps {
  mode?: "create" | "edit";
  relationKind?: RelationKind | null;
  spouses?: Person[];
  initialPerson?: Person;
  isSubmitting: boolean;
  onSubmit: (payload: PersonFormSubmitPayload) => Promise<void>;
  onBack?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

function defaultGender(relationKind: RelationKind | null | undefined): Gender | "" {
  if (relationKind === "father") {
    return "male";
  }
  if (relationKind === "mother") {
    return "female";
  }
  return "";
}

export function PersonForm({
  mode = "create",
  relationKind = null,
  spouses = [],
  initialPerson,
  isSubmitting,
  onSubmit,
  onBack,
  submitLabel,
  cancelLabel,
}: PersonFormProps) {
  const isEdit = mode === "edit";
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: initialPerson
      ? personToFormValues(initialPerson)
      : {
          firstName: "",
          middleName: "",
          lastName: "",
          maidenName: "",
          gender: (defaultGender(relationKind) || undefined) as Gender | undefined,
          birthDate: "",
          birthYear: "",
          deathDate: "",
          deathYear: "",
          birthPlace: "",
          biography: "",
          isLiving: true,
          secondParentId: "",
        },
  });

  const deathDate = watch("deathDate");
  const deathYear = watch("deathYear");
  const genderLocked =
    !isEdit && (relationKind === "father" || relationKind === "mother");

  useEffect(() => {
    if (initialPerson) {
      reset(personToFormValues(initialPerson));
    }
  }, [initialPerson, reset]);

  useEffect(() => {
    if (isEdit || !relationKind) {
      return;
    }
    if (relationKind === "father") {
      setValue("gender", "male");
    } else if (relationKind === "mother") {
      setValue("gender", "female");
    }
  }, [isEdit, relationKind, setValue]);

  useEffect(() => {
    if (deathDate || deathYear?.trim()) {
      setValue("isLiving", false);
    }
  }, [deathDate, deathYear, setValue]);

  const submit = handleSubmit(async (values) => {
    await onSubmit(valuesToPersonPayload(values));
  });

  const fieldClassName =
    "w-full rounded-xl border border-[#D9D0C3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C4A962]";

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-[#2D4A3E] sm:col-span-2">
          <span className="mb-1 block font-medium">Имя *</span>
          <input className={fieldClassName} {...register("firstName")} />
          {errors.firstName ? (
            <span className="mt-1 block text-xs text-red-700">
              {errors.firstName.message}
            </span>
          ) : null}
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Отчество</span>
          <input className={fieldClassName} {...register("middleName")} />
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Фамилия</span>
          <input className={fieldClassName} {...register("lastName")} />
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Девичья фамилия</span>
          <input className={fieldClassName} {...register("maidenName")} />
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Пол *</span>
          <select
            className={fieldClassName}
            disabled={genderLocked || isSubmitting}
            {...register("gender")}
          >
            {!genderLocked ? <option value="">Выберите пол</option> : null}
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="other">Другой</option>
            <option value="unknown">Не указан</option>
          </select>
          {errors.gender ? (
            <span className="mt-1 block text-xs text-red-700">
              {errors.gender.message}
            </span>
          ) : null}
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Дата рождения</span>
          <input
            type="date"
            className={fieldClassName}
            {...register("birthDate")}
          />
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Год рождения</span>
          <input
            inputMode="numeric"
            placeholder="если точная дата неизвестна"
            className={fieldClassName}
            {...register("birthYear")}
          />
          {errors.birthYear ? (
            <span className="mt-1 block text-xs text-red-700">
              {errors.birthYear.message}
            </span>
          ) : null}
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Дата смерти</span>
          <input
            type="date"
            className={fieldClassName}
            {...register("deathDate")}
          />
          {errors.deathDate ? (
            <span className="mt-1 block text-xs text-red-700">
              {errors.deathDate.message}
            </span>
          ) : null}
        </label>

        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Год смерти</span>
          <input
            inputMode="numeric"
            placeholder="если точная дата неизвестна"
            className={fieldClassName}
            {...register("deathYear")}
          />
          {errors.deathYear ? (
            <span className="mt-1 block text-xs text-red-700">
              {errors.deathYear.message}
            </span>
          ) : null}
        </label>

        <label className="block text-sm text-[#2D4A3E] sm:col-span-2">
          <span className="mb-1 block font-medium">Место рождения</span>
          <input className={fieldClassName} {...register("birthPlace")} />
        </label>

        <label className="block text-sm text-[#2D4A3E] sm:col-span-2">
          <span className="mb-1 block font-medium">Краткая биография</span>
          <textarea
            rows={3}
            className={`${fieldClassName} resize-y`}
            {...register("biography")}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#2D4A3E]">
        <input
          type="checkbox"
          {...register("isLiving")}
          disabled={Boolean(deathDate || deathYear?.trim())}
        />
        Человек жив
      </label>

      {!isEdit && relationKind === "child" && spouses.length > 0 ? (
        <label className="block text-sm text-[#2D4A3E]">
          <span className="mb-1 block font-medium">Указать второго родителя</span>
          <select className={fieldClassName} {...register("secondParentId")}>
            <option value="">Не указывать</option>
            {spouses.map((spouse) => (
              <option key={spouse.id} value={spouse.id}>
                {getFullName(spouse)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962] disabled:opacity-60"
          >
            {cancelLabel ?? (isEdit ? "Отмена" : "Назад")}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 flex-1 rounded-xl bg-[#2D4A3E] px-4 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Сохранение…"
            : (submitLabel ?? "Сохранить")}
        </button>
      </div>
    </form>
  );
}
