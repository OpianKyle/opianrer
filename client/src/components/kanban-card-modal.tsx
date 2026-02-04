import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, 
  X, 
  Calendar, 
  User, 
  Flag, 
  CheckCircle2, 
  Circle,
  Trash2,
  Edit3,
  UserPlus
} from 'lucide-react';
import type { KanbanCard, KanbanTask, User as UserType } from '@shared/schema';

interface KanbanCardModalProps {
  card: KanbanCard;
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800", 
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800"
};

export function KanbanCardModal({ card, isOpen, onClose }: KanbanCardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingCard, setEditingCard] = useState(false);
  const [cardData, setCardData] = useState({
    title: card.title,
    description: card.description || '',
    priority: card.priority || 'medium',
    dueDate: card.dueDate || '',
    assignedToId: card.assignedToId,
    tags: card.tags || []
  });
  
  const [newTask, setNewTask] = useState('');
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editingTaskData, setEditingTaskData] = useState<{
    title: string;
    description: string;
    assignedToId: number | null;
  }>({ title: '', description: '', assignedToId: null });

  // Fetch tasks for this card
  const { data: tasks = [] } = useQuery<KanbanTask[]>({
    queryKey: [`/api/kanban/cards/${card.id}/tasks`],
    enabled: isOpen,
  });

  // Fetch all users for assignment
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Update card mutation
  const updateCardMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/kanban/cards/${card.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban/columns/${card.columnId}/cards`] });
      setEditingCard(false);
      toast({
        title: "Success",
        description: "Card updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update card",
        variant: "destructive",
      });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return apiRequest("POST", "/api/kanban/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban/cards/${card.id}/tasks`] });
      setNewTask('');
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/kanban/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban/cards/${card.id}/tasks`] });
      setEditingTask(null);
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("DELETE", `/api/kanban/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban/cards/${card.id}/tasks`] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  const handleUpdateCard = () => {
    updateCardMutation.mutate(cardData);
  };

  const handleCreateTask = () => {
    if (!newTask.trim()) return;
    
    createTaskMutation.mutate({
      title: newTask,
      cardId: card.id,
      position: tasks.length,
      completed: false,
    });
  };

  const handleToggleTask = (task: KanbanTask) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { completed: !task.completed }
    });
  };

  const handleEditTask = (task: KanbanTask) => {
    console.log('Editing task:', task);
    setEditingTask(task.id);
    setEditingTaskData({
      title: task.title || '',
      description: task.description || '',
      assignedToId: task.assignedToId || null,
    });
  };

  const handleUpdateTask = () => {
    if (!editingTask) return;
    
    console.log('Updating task:', editingTask, 'with data:', editingTaskData);
    
    // Ensure we're sending the correct data structure
    const updateData = {
      title: editingTaskData.title,
      description: editingTaskData.description,
      assignedToId: editingTaskData.assignedToId
    };
    
    console.log('Sending update data:', updateData);
    
    updateTaskMutation.mutate({
      id: editingTask,
      data: updateData
    });
  };

  const handleDeleteTask = (taskId: number) => {
    deleteTaskMutation.mutate(taskId);
  };

  const getAssignedUserName = (userId: number | null) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user ? user.username : 'Unknown User';
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {editingCard ? (
              <Input
                value={cardData.title}
                onChange={(e) => setCardData(prev => ({ ...prev, title: e.target.value }))}
                className="text-lg font-semibold"
              />
            ) : (
              <>
                <span>{card.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingCard(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Card Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge className={PRIORITY_COLORS[card.priority as keyof typeof PRIORITY_COLORS]}>
                <Flag className="h-3 w-3 mr-1" />
                {card.priority}
              </Badge>
              
              {card.dueDate && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(card.dueDate).toLocaleDateString()}
                </Badge>
              )}
              
              <Badge variant="outline">
                <User className="h-3 w-3 mr-1" />
                {getAssignedUserName(card.assignedToId)}
              </Badge>
            </div>

            {editingCard && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={cardData.priority}
                    onValueChange={(value) => setCardData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={cardData.dueDate}
                    onChange={(e) => setCardData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Assigned To</Label>
                  <Select
                    value={cardData.assignedToId?.toString() || 'unassigned'}
                    onValueChange={(value) => setCardData(prev => ({ ...prev, assignedToId: value === 'unassigned' ? null : parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            {editingCard ? (
              <Textarea
                value={cardData.description}
                onChange={(e) => setCardData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Card description..."
                className="min-h-[100px]"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md min-h-[100px]">
                {card.description || 'No description provided'}
              </div>
            )}
          </div>

          {editingCard && (
            <div className="flex gap-2">
              <Button 
                onClick={handleUpdateCard}
                disabled={updateCardMutation.isPending}
              >
                Save Changes
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingCard(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          <Separator />

          {/* Tasks Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Tasks</h3>
              <div className="text-sm text-gray-500">
                {completedTasks}/{totalTasks} completed
              </div>
            </div>

            {/* Progress bar */}
            {totalTasks > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            )}

            {/* Add new task */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a new task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTask()}
              />
              <Button 
                onClick={handleCreateTask}
                disabled={!newTask.trim() || createTaskMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tasks list */}
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleTask(task)}
                  />
                  
                  {editingTask === task.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editingTaskData?.title || ''}
                        onChange={(e) => setEditingTaskData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Task title"
                      />
                      <Textarea
                        value={editingTaskData?.description || ''}
                        onChange={(e) => setEditingTaskData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Task description"
                        className="min-h-[60px]"
                      />
                      <Select
                        value={editingTaskData?.assignedToId?.toString() || 'unassigned'}
                        onValueChange={(value) => setEditingTaskData(prev => ({ ...prev, assignedToId: value === 'unassigned' ? null : parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map(user => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateTask}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTask(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-gray-600">
                            {task.description}
                          </div>
                        )}
                        {task.assignedToId && (
                          <div className="text-xs text-gray-500 mt-1">
                            <UserPlus className="h-3 w-3 inline mr-1" />
                            {getAssignedUserName(task.assignedToId)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}