import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  User, 
  Mail, 
  Shield, 
  Edit3, 
  Save,
  X,
  Calendar,
  Clock,
  Activity,
  Camera,
  Upload,
  Trash2,
  Scissors,
  Check
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    username: user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData = { ...data };
      // Only include password if it's being changed
      if (!updateData.newPassword) {
        delete updateData.currentPassword;
        delete updateData.newPassword;
        delete updateData.confirmPassword;
      } else {
        updateData.password = updateData.newPassword;
        delete updateData.newPassword;
        delete updateData.confirmPassword;
      }
      
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update profile');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast({
        title: "Success",
        description: "Profile updated successfully",
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

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user?.id?.toString() || '');
      
      const response = await fetch('/api/profile-picture', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to upload profile picture');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Force refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.refetchQueries({ queryKey: ["/api/user"] });
      setIsCropperOpen(false);
      setSelectedImage(null);
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
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

  const deleteProfilePictureMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/profile-picture/${user?.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete profile picture');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.refetchQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Success",
        description: "Profile picture removed successfully",
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      // For debugging: Option to upload directly without cropping
      // Hold Ctrl/Cmd while selecting to skip cropping
      if (event.ctrlKey || event.metaKey) {
        uploadProfilePictureMutation.mutate(file);
        return;
      }
      
      // Create preview URL and open cropper
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    
    // Center the crop on the image and make it circular
    const cropSize = Math.min(naturalWidth, naturalHeight) * 0.8; // Use 80% of the smaller dimension
    const x = (naturalWidth - cropSize) / 2;
    const y = (naturalHeight - cropSize) / 2;
    
    setCrop({
      unit: 'px',
      width: cropSize,
      height: cropSize,
      x: x,
      y: y,
    });
  }, []);

  const getCroppedImg = useCallback((
    image: HTMLImageElement,
    crop: PixelCrop,
    fileName: string
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Validate crop dimensions
        if (crop.width <= 0 || crop.height <= 0) {
          reject(new Error('Invalid crop dimensions'));
          return;
        }
        
        // Set canvas size to a fixed size for profile pictures
        const size = 200; // Fixed size for profile pictures
        canvas.width = size;
        canvas.height = size;
        
        // Calculate scale factors
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        // Calculate actual crop dimensions in original image coordinates
        const actualCropX = crop.x * scaleX;
        const actualCropY = crop.y * scaleY;
        const actualCropWidth = crop.width * scaleX;
        const actualCropHeight = crop.height * scaleY;
        
        // Clear canvas and fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        // Draw the cropped image
        ctx.drawImage(
          image,
          actualCropX,
          actualCropY,
          actualCropWidth,
          actualCropHeight,
          0,
          0,
          size,
          size
        );
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            resolve(file);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.90);
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const handleCropComplete = useCallback(async () => {
    if (!completedCrop || !imgRef.current) {
      console.log('Missing crop data:', { completedCrop, imgRef: imgRef.current });
      return;
    }
    
    try {
      console.log('Crop data:', completedCrop);
      console.log('Image dimensions:', {
        width: imgRef.current.width,
        height: imgRef.current.height,
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight
      });
      
      const croppedFile = await getCroppedImg(
        imgRef.current,
        completedCrop,
        `profile-${Date.now()}.jpg`
      );
      
      console.log('Cropped file:', croppedFile);
      uploadProfilePictureMutation.mutate(croppedFile);
    } catch (error) {
      console.error('Crop error:', error);
      toast({
        title: "Error",
        description: "Failed to crop image",
        variant: "destructive",
      });
    }
  }, [completedCrop, getCroppedImg, uploadProfilePictureMutation, toast]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeletePicture = () => {
    deleteProfilePictureMutation.mutate();
  };

  const handleSave = () => {
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      username: user?.username || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditing(false);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return { text: 'Super Admin', color: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' };
      case 'admin':
        return { text: 'Admin', color: 'bg-blue-600 text-white' };
      case 'user':
        return { text: 'User', color: 'bg-green-600 text-white' };
      default:
        return { text: 'User', color: 'bg-gray-600 text-white' };
    }
  };

  const roleDisplay = getRoleDisplay(user?.role || 'user');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className={roleDisplay.color}>
            <Shield className="w-3 h-3 mr-1" />
            {roleDisplay.text}
          </Badge>
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            <Activity className="w-3 h-3 mr-1" />
            Active
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Information</span>
                </CardTitle>
                <Button
                  variant={isEditing ? "outline" : "default"}
                  size="sm"
                  onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                  className="flex items-center space-x-2"
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-6">
                <div className="relative group">
                  <Avatar className="w-20 h-20">
                    {user?.profileImageUrl ? (
                      <AvatarImage 
                        src={user.profileImageUrl} 
                        alt="Profile picture"
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-semibold">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
                        : user?.username?.charAt(0)?.toUpperCase() || 'U'
                      }
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Profile Picture Upload Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleUploadClick}
                        disabled={uploadProfilePictureMutation.isPending}
                        className="p-2 h-8 w-8"
                      >
                        {uploadProfilePictureMutation.isPending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </Button>
                      {user?.profileImageUrl && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleDeletePicture}
                          disabled={deleteProfilePictureMutation.isPending}
                          className="p-2 h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.username || 'User'
                    }
                  </h3>
                  <p className="text-gray-600">{user?.email}</p>
                  <p className="text-sm text-gray-500">@{user?.username}</p>
                  
                  {/* Upload Instructions */}
                  <div className="mt-2 flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUploadClick}
                      disabled={uploadProfilePictureMutation.isPending}
                      className="text-xs"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      {uploadProfilePictureMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                    </Button>
                    <span className="text-xs text-gray-500">Max 5MB, JPG/PNG</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {isEditing && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Change Password</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Enter current password"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Leave password fields empty if you don't want to change your password
                    </p>
                  </div>
                </>
              )}

              {isEditing && (
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Account Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Role</Label>
                <div className="mt-1">
                  <Badge className={roleDisplay.color}>
                    {roleDisplay.text}
                  </Badge>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                <div className="mt-1 flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Last Seen</Label>
                <div className="mt-1 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {user?.lastSeen 
                      ? formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })
                      : 'Never'
                    }
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="mt-1">
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <Activity className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                <p className="mt-1 text-sm text-gray-700">{user?.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Username</Label>
                <p className="mt-1 text-sm text-gray-700">@{user?.username}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Cropper Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Scissors className="w-5 h-5" />
              <span>Crop Profile Picture</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedImage && (
              <div className="flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                  className="max-w-full max-h-96"
                >
                  <img
                    ref={imgRef}
                    src={selectedImage}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    className="max-w-full max-h-96 object-contain"
                  />
                </ReactCrop>
              </div>
            )}
            
            <div className="text-center text-sm text-gray-500">
              Adjust the circle to crop your profile picture
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCropperOpen(false);
                setSelectedImage(null);
              }}
              disabled={uploadProfilePictureMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCropComplete}
              disabled={uploadProfilePictureMutation.isPending || !completedCrop}
              className="flex items-center space-x-2"
            >
              {uploadProfilePictureMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {uploadProfilePictureMutation.isPending ? 'Uploading...' : 'Apply Crop'}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}