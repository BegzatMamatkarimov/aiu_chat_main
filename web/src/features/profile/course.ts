import { useTranslation } from 'react-i18next'

// 1–4: бакалавриат, 5: магистратура 1 курс, 6: магистратура 2 курс
export const COURSE_VALUES = [1, 2, 3, 4, 5, 6] as const
export type CourseValue = (typeof COURSE_VALUES)[number]

export function isCourseValue(value: number | null | undefined): value is CourseValue {
  return COURSE_VALUES.includes(value as CourseValue)
}

export function useCourseLabel() {
  const { t } = useTranslation()
  return (course: number | null | undefined) =>
    isCourseValue(course) ? t(`profile.course.${course}`) : ''
}
