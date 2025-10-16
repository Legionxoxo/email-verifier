/**
 * Card component with Notion-inspired design
 * Provides consistent container styling throughout the app
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    variant?: 'default' | 'bordered' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

/**
 * Main Card component
 * @param children - Card content
 * @param variant - Card visual variant
 * @param padding - Internal padding size
 * @param className - Additional CSS classes
 * @param props - Additional div props
 * @returns Card JSX element
 */
export function Card({
    children,
    variant = 'default',
    padding = 'md',
    className,
    ...props
}: CardProps) {
    try {
        const variants = {
            default: 'bg-white border border-gray-200',
            bordered: 'bg-white border border-gray-300',
            elevated: 'bg-white border border-gray-200 shadow-lg',
        };

        const paddings = {
            none: '',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8',
        };

        const cardClasses = cn(
            'rounded-lg transition-colors',
            variants[variant],
            paddings[padding],
            className
        );

        return (
            <div className={cardClasses} {...props}>
                {children}
            </div>
        );
    } catch (error) {
        console.error('Card render error:', error);
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {children}
            </div>
        );
    }
}

/**
 * Card Header component
 * @param children - Header content
 * @param className - Additional CSS classes
 * @param props - Additional div props
 * @returns CardHeader JSX element
 */
export function CardHeader({ children, className, ...props }: CardHeaderProps) {
    try {
        return (
            <div
                className={cn('flex flex-col space-y-1.5 pb-4', className)}
                {...props}
            >
                {children}
            </div>
        );
    } catch (error) {
        console.error('CardHeader render error:', error);
        return (
            <div className="pb-4">
                {children}
            </div>
        );
    }
}

/**
 * Card Content component
 * @param children - Content
 * @param className - Additional CSS classes
 * @param props - Additional div props
 * @returns CardContent JSX element
 */
export function CardContent({ children, className, ...props }: CardContentProps) {
    try {
        return (
            <div className={cn('space-y-4', className)} {...props}>
                {children}
            </div>
        );
    } catch (error) {
        console.error('CardContent render error:', error);
        return (
            <div>
                {children}
            </div>
        );
    }
}

/**
 * Card Footer component
 * @param children - Footer content
 * @param className - Additional CSS classes
 * @param props - Additional div props
 * @returns CardFooter JSX element
 */
export function CardFooter({ children, className, ...props }: CardFooterProps) {
    try {
        return (
            <div
                className={cn('flex items-center pt-4', className)}
                {...props}
            >
                {children}
            </div>
        );
    } catch (error) {
        console.error('CardFooter render error:', error);
        return (
            <div className="pt-4">
                {children}
            </div>
        );
    }
}

/**
 * Card Title component
 * @param children - Title content
 * @param className - Additional CSS classes
 * @param props - Additional heading props
 * @returns CardTitle JSX element
 */
export function CardTitle({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    try {
        return (
            <h3
                className={cn('text-lg font-semibold text-gray-900', className)}
                {...props}
            >
                {children}
            </h3>
        );
    } catch (error) {
        console.error('CardTitle render error:', error);
        return (
            <h3 className="text-lg font-semibold text-gray-900">
                {children}
            </h3>
        );
    }
}

/**
 * Card Description component
 * @param children - Description content
 * @param className - Additional CSS classes
 * @param props - Additional paragraph props
 * @returns CardDescription JSX element
 */
export function CardDescription({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    try {
        return (
            <p
                className={cn('text-sm text-gray-600', className)}
                {...props}
            >
                {children}
            </p>
        );
    } catch (error) {
        console.error('CardDescription render error:', error);
        return (
            <p className="text-sm text-gray-600">
                {children}
            </p>
        );
    }
}