import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/data";

export function CategorySelect({
  categories,
  value,
  onChange,
  className,
}: {
  categories: CategoryRow[];
  value: string;
  onChange: (path: string) => void;
  className?: string;
}) {
  const groups = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    return parents.map((parent) => ({
      parent,
      children: categories
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [categories]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Choose category" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map(({ parent, children }) => (
          <SelectGroup key={parent.id}>
            <SelectLabel>{parent.name}</SelectLabel>
            {children.map((child) => (
              <SelectItem key={child.id} value={`${parent.name} > ${child.name}`}>
                {child.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
