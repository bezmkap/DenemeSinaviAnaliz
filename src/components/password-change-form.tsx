"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Yeni şifreler eşleşmiyor.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Şifre değiştirilemedi.");
        return;
      }
      toast.success("Şifreniz güncellendi. Onay gerekmez.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Şifre değiştir</CardTitle>
        <CardDescription>
          Okul kendi şifresini buradan yeniler. Yönetici onayı veya e-posta doğrulaması yoktur.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current">Mevcut şifre</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="next">Yeni şifre</Label>
            <Input
              id="next"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Yeni şifre (tekrar)</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Şifreyi güncelle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
