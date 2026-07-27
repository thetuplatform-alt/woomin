// components/admin/users/course-multi-select.tsx
// 課程多選元件
// 用於新增用戶 / 匯入學員時，同流程指派一門或多門課程

'use client'

import { useMemo } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, Loader2, BookOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CourseOption {
  id: string
  title: string
}

interface CourseMultiSelectProps {
  courses: CourseOption[]
  value: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
}

export function CourseMultiSelect({
  courses,
  value,
  onChange,
  loading = false,
  disabled = false,
  placeholder = '選擇課程（可多選）',
}: CourseMultiSelectProps) {
  const selectedCourses = useMemo(
    () => courses.filter((c) => value.includes(c.id)),
    [courses, value]
  )

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || loading}
            className="w-full justify-between bg-white border-divider text-heading hover:bg-surface rounded-lg font-normal"
          >
            <span className="flex items-center gap-2 text-body">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-caption" />
              ) : (
                <BookOpen className="h-4 w-4 text-caption" />
              )}
              {value.length > 0 ? `已選 ${value.length} 門課程` : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border-divider"
          align="start"
        >
          <Command>
            <CommandInput placeholder="搜尋課程..." className="h-9" />
            <CommandList>
              <CommandEmpty>
                {courses.length === 0 ? '沒有可指派的課程' : '找不到符合的課程'}
              </CommandEmpty>
              <CommandGroup>
                {courses.map((course) => {
                  const checked = value.includes(course.id)
                  return (
                    <CommandItem
                      key={course.id}
                      value={course.title}
                      onSelect={() => toggle(course.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 text-cta',
                          checked ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="text-body">{course.title}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 已選課程標籤 */}
      {selectedCourses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCourses.map((course) => (
            <Badge
              key={course.id}
              className="bg-surface hover:bg-surface text-body border border-divider gap-1 font-normal"
            >
              {course.title}
              <button
                type="button"
                onClick={() => toggle(course.id)}
                className="ml-0.5 rounded-full hover:text-heading"
                aria-label={`移除 ${course.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
