import { useState } from "react";
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// Team members now use the users table directly
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  Plus, 
  Mail, 
  Building,
  Shield,
  Edit,
  Trash2,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/theme-context";
import { usePresence } from "@/hooks/use-presence";
import { PresenceIndicator } from "@/components/presence-indicator";
// AddTeamMemberModal replaced by user creation

export default function TeamMembers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { users: presenceUsers, refreshUsers } = usePresence();
  const { theme, themes } = useTheme();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    password: '',
    role: ''
  });
  const [addForm, setAddForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  
  // Use users table as the source of truth for team members
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Merge presence data with users data
  const usersWithPresence = users.map(user => {
    const presenceUser = presenceUsers.find(p => p.id === user.id);
    return {
      ...user,
      isOnline: presenceUser?.isOnline || false,
      lastSeen: presenceUser?.lastSeen || user.lastSeen
    };
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  // Clear auth cache to force reload of user data with role
  React.useEffect(() => {
    if (user && !user.role) {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
  }, [user]);

  // Debug logging
  console.log('Current user role:', user?.role);
  console.log('Is super admin:', isSuperAdmin);
  console.log('User object:', user);

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: any }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUserId(null);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
  };

  const handleSaveUser = () => {
    const updateData = { ...editForm };
    if (!updateData.password) {
      delete updateData.password;
    }
    updateUserMutation.mutate({ id: editingUser.id, userData: updateData });
  };

  const handleDeleteUser = (userId: number) => {
    setDeleteUserId(userId);
  };

  const confirmDeleteUser = () => {
    if (deleteUserId) {
      deleteUserMutation.mutate(deleteUserId);
    }
  };

  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddModalOpen(false);
      setAddForm({ username: '', email: '', password: '', role: 'user' });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddUser = () => {
    addUserMutation.mutate(addForm);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="p-6 space-y-6 min-h-screen transition-all duration-300"
        style={{
          backgroundColor: themes[theme].colors.background,
          color: themes[theme].colors.text,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-2xl font-bold transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Team Members
            </h1>
            <p 
              className="transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              All system users with their roles and access levels
            </p>
            <div className="flex items-center space-x-4 mt-2">
              {user?.role === 'super_admin' && (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  Super Admin Access
                </Badge>
              )}
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Wifi className="w-3 h-3 mr-1" />
                  {usersWithPresence.filter(u => u.isOnline).length} Online
                </Badge>
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                  <WifiOff className="w-3 h-3 mr-1" />
                  {usersWithPresence.filter(u => !u.isOnline).length} Offline
                </Badge>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="text-white transition-all duration-300"
            style={{
              background: themes[theme].colors.gradient,
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Team Member
          </Button>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usersWithPresence.map((member) => (
            <Card 
              key={member.id} 
              className="hover:shadow-lg transition-all duration-300"
              style={{
                backgroundColor: themes[theme].colors.surface,
                borderColor: themes[theme].colors.border,
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      {member.profileImageUrl ? (
                        <AvatarImage 
                          src={member.profileImageUrl} 
                          alt="Profile picture"
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm">
                        {(member.firstName && member.lastName) ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}` : member.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle 
                        className="text-lg transition-colors duration-300"
                        style={{ color: themes[theme].colors.text }}
                      >
                        {(member.firstName && member.lastName) ? `${member.firstName} ${member.lastName}` : member.username}
                      </CardTitle>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          member.role === 'super_admin' ? 'bg-red-100 text-red-700 border-red-200' :
                          member.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          member.role === 'user' ? 'bg-green-100 text-green-700 border-green-200' :
                          member.role === 'viewer' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                          'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {member.role?.replace('_', ' ').toUpperCase() || 'USER'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <PresenceIndicator user={member} showLastSeen={false} size="md" />
                    <Badge variant="default" className={`${member.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {member.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div 
                    className="flex items-center space-x-2 text-sm transition-colors duration-300"
                    style={{ color: themes[theme].colors.textSecondary }}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                  </div>
                  <div 
                    className="flex items-center space-x-2 text-sm transition-colors duration-300"
                    style={{ color: themes[theme].colors.textSecondary }}
                  >
                    <Building className="w-4 h-4" />
                    <span>System User</span>
                  </div>
                  <div className="space-y-1">
                    <div 
                      className="text-xs transition-colors duration-300"
                      style={{ color: themes[theme].colors.textSecondary }}
                    >
                      Joined: {new Date(member.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <PresenceIndicator user={member} showLastSeen={true} size="sm" />
                    </div>
                  </div>
                  
                  {isSuperAdmin && (
                    <div 
                      className="flex items-center space-x-2 pt-3 border-t transition-colors duration-300"
                      style={{ borderColor: themes[theme].colors.border }}
                    >
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEditUser(member)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {member.id !== user?.id && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteUser(member.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
            <p className="text-gray-500 mb-4">
              {isAdmin 
                ? "Add your first team member to start assigning appointments" 
                : "Team members will appear here once added by an administrator"
              }
            </p>
            {isSuperAdmin && (
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New User
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-username">Username</Label>
              <Input
                id="add-username"
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div>
              <Label htmlFor="add-role">Role</Label>
              <Select value={addForm.role} onValueChange={(value) => setAddForm({ ...addForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser}
                disabled={addUserMutation.isPending}
              >
                {addUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="password">Password (leave empty to keep current)</Label>
              <Input
                id="password"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Enter new password or leave empty"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUser}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}