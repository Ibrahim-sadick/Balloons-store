"use client"

import * as React from "react"
import { FolderTree, MapPin, Plus, Users } from "lucide-react"
import {
  EmeraldButton,
  PillButton,
  fieldInputClass,
  FilterSelect,
  FormError,
  PageIntro,
  Panel,
  SearchField,
} from "@/components/controls"
import { EmptyState } from "@/components/empty-state"
import { RoleBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStore } from "@/lib/store"
import type { Role } from "@/lib/types"

// One role exists by design. This store is run by a single administrator and the
// API issues exactly one account, so offering Storekeeper or Viewer here would
// advertise a choice that does not exist.
const roles: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrator" },
]

export function SettingsPage() {
  const {
    users,
    categories,
    locations,
    equipment,
    session,
    setUserRole,
    addCategory,
    addLocation,
  } = useStore()
  const [tab, setTab] = React.useState("users")
  const [query, setQuery] = React.useState("")
  const [categoryName, setCategoryName] = React.useState("")
  const [locationName, setLocationName] = React.useState("")
  const [zone, setZone] = React.useState("")
  const [error, setError] = React.useState("")
  const isAdmin = session?.role === "ADMIN"
  const canWrite = session?.role !== "VIEWER"

  const visibleUsers = users.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.role}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div>
      <PageIntro
        title="Settings"
        description="Who can touch the register, and how the cage is divided."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList className="min-h-10 gap-0.5 rounded-lg p-1">
            <TabsTrigger value="users" className="px-4 text-[13px]">Users & roles</TabsTrigger>
            <TabsTrigger value="categories" className="px-4 text-[13px]">Categories</TabsTrigger>
            <TabsTrigger value="locations" className="px-4 text-[13px]">Store locations</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SearchField value={query} onChange={setQuery} placeholder="Name, email, or role" />
            <p className="text-[11px] text-slate-500">
              {isAdmin ? "You can change roles." : "This account is the storekeeper."}
            </p>
          </div>
          <Panel title="Store accounts" count={visibleUsers.length}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Name", "Email", "Role"].map((label) => (
                    <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        icon={Users}
                        title="No store accounts yet"
                        description="Sign-in accounts are issued with the app. They show up here once they exist."
                      />
                    </TableCell>
                  </TableRow>
                ) : visibleUsers.map((user) => (
                  <TableRow key={user.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell className="px-3 py-2.5 text-[12px] font-normal text-slate-900">{user.name}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{user.email}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      {isAdmin ? (
                        <FilterSelect
                          value={user.role}
                          onChange={(role) => void setUserRole(user.id, role as Role)}
                          options={roles}
                        />
                      ) : (
                        <RoleBadge role={user.role} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="categories">
          <form
            className="mb-3 flex flex-wrap items-center justify-between gap-2"
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await addCategory(categoryName)
              if (!result.ok) {
                setError(result.message)
                return
              }
              setCategoryName("")
              setError("")
            }}
          >
            <Input
              id="new-category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="New category"
              className={`${fieldInputClass} max-w-xs`}
            />
            <EmeraldButton type="submit" disabled={!canWrite}>
              <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Add category
            </EmeraldButton>
            <FormError message={tab === "categories" ? error : ""} />
          </form>
          <Panel title="Categories" count={categories.length}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Code", "Category", "Assets"].map((label) => (
                    <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        icon={FolderTree}
                        title="No categories yet"
                        description="Group tools before the first asset is filed. Power tools, safety, survey, and so on."
                        action={
                          <PillButton
                            type="button"
                            disabled={!canWrite}
                            onClick={() => document.getElementById("new-category")?.focus()}
                          >
                            Add category
                          </PillButton>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : categories.map((category) => {
                  const count = equipment.filter((item) => item.categoryId === category.id).length
                  return (
                    <TableRow key={category.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{category.code}</TableCell>
                      <TableCell className="px-3 py-2.5 text-[12px] font-normal">{category.name}</TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{count}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="locations">
          <form
            className="mb-3 flex flex-wrap items-center justify-between gap-2"
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await addLocation({ name: locationName, zone })
              if (!result.ok) {
                setError(result.message)
                return
              }
              setLocationName("")
              setZone("")
              setError("")
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="new-location"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Location name"
                className={`${fieldInputClass} w-56`}
              />
              <Input
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                placeholder="Zone"
                className={`${fieldInputClass} w-40`}
              />
            </div>
            <EmeraldButton type="submit" disabled={!canWrite}>
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Add location
            </EmeraldButton>
            <FormError message={tab === "locations" ? error : ""} />
          </form>
          <Panel title="Store locations" count={locations.length}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Code", "Location", "Zone", "Assets"].map((label) => (
                    <TableHead key={label} className="h-9 bg-slate-50 px-3 text-[10px] font-normal uppercase tracking-wider text-slate-400">{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState
                        icon={MapPin}
                        title="No store locations yet"
                        description="Name the cages and rooms where equipment lives before you file the first asset."
                        action={
                          <PillButton
                            type="button"
                            disabled={!canWrite}
                            onClick={() => document.getElementById("new-location")?.focus()}
                          >
                            Add location
                          </PillButton>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : locations.map((location) => {
                  const count = equipment.filter((item) => item.locationId === location.id).length
                  return (
                    <TableRow key={location.id} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{location.code}</TableCell>
                      <TableCell className="px-3 py-2.5 text-[12px] font-normal">{location.name}</TableCell>
                      <TableCell className="px-3 py-2.5 text-[12px]">{location.zone}</TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-[11px] tabular-nums">{count}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
