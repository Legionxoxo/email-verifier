/**
 * API Token Management Page
 * Allows users to create, view, and revoke API tokens
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Key,
    Plus,
    Trash2,
    Copy,
    CheckCircle,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { toast } from 'react-toastify';
import { apiKeyApi } from '../lib/api';
import type { ApiKey } from '../lib/api';

/**
 * API Token management page
 * @returns APITokenPage JSX element
 */
export function APITokenPage() {
    const navigate = useNavigate();
    const location = useLocation();

    // State management
    const [tokens, setTokens] = React.useState<ApiKey[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string>('');
    const [showCreateForm, setShowCreateForm] = React.useState(false);

    // Create token form state
    const [tokenName, setTokenName] = React.useState('');
    const [expiryDays, setExpiryDays] = React.useState<number | ''>('');
    const [newToken, setNewToken] = React.useState<string>('');
    const [copiedTokenId, setCopiedTokenId] = React.useState<string>('');

    // Load tokens on mount and whenever we navigate to this page
    React.useEffect(() => {
        loadTokens();
    }, [location.pathname]);

    // Also reload when page becomes visible again (handles browser tab switching)
    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadTokens();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);


    const loadTokens = async () => {
        try {
            setLoading(true);
            setError('');

            const apiKeys = await apiKeyApi.listApiKeys();
            setTokens(apiKeys);

        } catch (error) {
            console.error('Failed to load API tokens:', error);
            setError(error instanceof Error ? error.message : 'Failed to load API tokens');
            toast.error(error instanceof Error ? error.message : 'Failed to load API tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateToken = async () => {
        try {
            setLoading(true);
            setError('');

            // Validate inputs
            if (!tokenName.trim()) {
                setError('Please enter a token name');
                toast.error('Please enter a token name');
                return;
            }

            const response = await apiKeyApi.createApiKey(
                tokenName.trim(),
                expiryDays ? Number(expiryDays) : null
            );

            // Store the full plain-text API key to display
            setNewToken(response.apiKey);

            // Add masked version to tokens list
            const newTokenData: ApiKey = {
                id: response.keyData.id,
                name: response.keyData.name,
                key_masked: `${response.keyData.key_prefix}***xyz`,
                created_at: response.keyData.created_at,
                expires_at: response.keyData.expires_at,
                last_used: null,
                is_revoked: false
            };

            setTokens(prev => [newTokenData, ...prev]);
            toast.success('API key created successfully!');

            // Reset form fields but keep newToken to show warning
            setTokenName('');
            setExpiryDays('');

        } catch (error) {
            console.error('Failed to create API token:', error);
            setError(error instanceof Error ? error.message : 'Failed to create API token');
            toast.error(error instanceof Error ? error.message : 'Failed to create API token');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeToken = async (tokenId: number) => {
        try {
            if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
                return;
            }

            setLoading(true);
            setError('');

            await apiKeyApi.revokeApiKey(tokenId);

            // Remove from list
            setTokens(prev => prev.filter(t => t.id !== tokenId));
            toast.success('API key revoked successfully');

        } catch (error) {
            console.error('Failed to revoke API token:', error);
            setError(error instanceof Error ? error.message : 'Failed to revoke API token');
            toast.error(error instanceof Error ? error.message : 'Failed to revoke API token');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToken = (token: string, tokenId: number | string) => {
        try {
            navigator.clipboard.writeText(token);
            setCopiedTokenId(String(tokenId));
            toast.success('Token copied to clipboard');

            // Reset copied state after 2 seconds
            setTimeout(() => {
                setCopiedTokenId('');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy token:', error);
            toast.error('Failed to copy token');
        }
    };

    const handleBackNavigation = () => {
        try {
            navigate('/dashboard');
        } catch (error) {
            console.error('Back navigation error:', error);
            window.history.back();
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never expires';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatRelativeTime = (dateString: string | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBackNavigation}
                                className="flex items-center space-x-1 cursor-pointer"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back</span>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    API Tokens
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    Create and manage API tokens for programmatic access
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="flex items-center space-x-2 cursor-pointer"
                            disabled={loading}
                        >
                            <Plus className="h-4 w-4" />
                            <span>Create Token</span>
                        </Button>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6"
                    >
                        <Card className="border-red-200 bg-red-50">
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    <span className="text-sm text-red-800">{error}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setError('')}
                                        className="ml-auto cursor-pointer"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Create Token Form */}
                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle>Create New API Token</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {newToken ? (
                                    // Show only the token warning after creation
                                    <>
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-start space-x-2">
                                                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-yellow-900 mb-2">
                                                        Save this token now! You won't be able to see it again.
                                                    </p>
                                                    <div className="flex items-center space-x-2">
                                                        <code className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded text-sm font-mono text-gray-900 break-all">
                                                            {newToken}
                                                        </code>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleCopyToken(newToken, 'new')}
                                                            className="cursor-pointer flex-shrink-0"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4 border-t">
                                            <Button
                                                variant="primary"
                                                onClick={() => {
                                                    setShowCreateForm(false);
                                                    setTokenName('');
                                                    setExpiryDays('');
                                                    setNewToken('');
                                                }}
                                                className="cursor-pointer"
                                            >
                                                Close
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    // Show form fields before token creation
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Token Name"
                                                type="text"
                                                placeholder="e.g., Production API"
                                                value={tokenName}
                                                onChange={(e) => setTokenName(e.target.value)}
                                                helper="A descriptive name for this token"
                                                fullWidth
                                            />

                                            <Input
                                                label="Expiry (days)"
                                                type="number"
                                                placeholder="e.g., 30 (leave empty for no expiry)"
                                                value={expiryDays}
                                                onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : '')}
                                                helper="Token will expire after this many days"
                                                fullWidth
                                            />
                                        </div>

                                        <div className="flex justify-end space-x-3 pt-4 border-t">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setShowCreateForm(false);
                                                    setTokenName('');
                                                    setExpiryDays('');
                                                }}
                                                className="cursor-pointer"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleCreateToken}
                                                disabled={loading || !tokenName.trim()}
                                                className="cursor-pointer"
                                            >
                                                {loading ? 'Creating...' : 'Create Token'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Tokens List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Key className="h-5 w-5" />
                                <span>Your API Tokens</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading && tokens.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
                                    <p className="text-gray-600">Loading tokens...</p>
                                </div>
                            ) : tokens.length === 0 ? (
                                <div className="text-center py-12">
                                    <Key className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No API Tokens
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Create your first API token to start using the API
                                    </p>
                                    <Button
                                        variant="primary"
                                        onClick={() => setShowCreateForm(true)}
                                        className="cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Token
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {tokens.map((token) => (
                                        <div
                                            key={token.id}
                                            className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <h3 className="text-base font-semibold text-gray-900">
                                                            {token.name}
                                                        </h3>
                                                        {token.expires_at && (
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                                                Expires {formatDate(token.expires_at)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center space-x-2 mb-3">
                                                        <code className="px-3 py-1.5 bg-gray-100 rounded text-sm font-mono text-gray-700">
                                                            {token.key_masked}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleCopyToken(token.key_masked, token.id)}
                                                            className="cursor-pointer"
                                                        >
                                                            {copiedTokenId === String(token.id) ? (
                                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center space-x-4 text-xs">
                                                        <span className="text-gray-500">Created {formatDate(token.created_at)}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="text-gray-600">
                                                            Last used: <span className="font-medium text-blue-600">{formatRelativeTime(token.last_used)}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRevokeToken(token.id)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                                    disabled={loading}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* API Documentation Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6"
                >
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 mb-1">
                                        API Documentation
                                    </p>
                                    <p className="text-sm text-blue-800">
                                        Use your API token in the <code className="px-1 py-0.5 bg-blue-100 rounded">Authorization</code> header as{' '}
                                        <code className="px-1 py-0.5 bg-blue-100 rounded">Bearer YOUR_TOKEN</code>.
                                        Check our API documentation for more details.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
