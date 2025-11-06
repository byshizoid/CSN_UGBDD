#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для удаления неиспользуемых фотографий из папки photos/
Сравнивает файлы в папке photos/ со списком файлов, используемых в data.json
"""

import json
import os
from pathlib import Path

def get_used_photos(data_file='data.json'):
    """Получает список всех используемых фотографий из data.json"""
    used_photos = set()
    
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Проверяем новую структуру с сопровождениями
        if 'escorts' in data and isinstance(data['escorts'], dict):
            for escort_id, escort_data in data['escorts'].items():
                # Добавляем карту, если есть
                if escort_data.get('mapImage'):
                    map_path = escort_data['mapImage']
                    if map_path.startswith('photos/'):
                        used_photos.add(map_path)
                
                # Добавляем фото перекрытий
                for closure in escort_data.get('closures', []):
                    for photo in closure.get('photos', []):
                        if photo.startswith('photos/'):
                            used_photos.add(photo)
        # Старая структура (обратная совместимость)
        elif 'closures' in data:
            # Добавляем карту
            if data.get('mapImage'):
                map_path = data['mapImage']
                if map_path.startswith('photos/'):
                    used_photos.add(map_path)
            
            # Добавляем фото перекрытий
            for closure in data.get('closures', []):
                for photo in closure.get('photos', []):
                    if photo.startswith('photos/'):
                        used_photos.add(photo)
                # Поддержка старого формата с одним фото
                if closure.get('photo') and not closure.get('photos'):
                    photo = closure['photo']
                    if photo.startswith('photos/'):
                        used_photos.add(photo)
        
        print(f"Найдено используемых файлов: {len(used_photos)}")
        return used_photos
        
    except FileNotFoundError:
        print(f"Ошибка: файл {data_file} не найден!")
        return set()
    except json.JSONDecodeError as e:
        print(f"Ошибка: не удалось прочитать {data_file}: {e}")
        return set()

def get_all_photos(photos_dir='photos'):
    """Получает список всех файлов в папке photos/"""
    photos_path = Path(photos_dir)
    if not photos_path.exists():
        print(f"Ошибка: папка {photos_dir} не существует!")
        return set()
    
    all_photos = set()
    for file in photos_path.iterdir():
        if file.is_file():
            # Сохраняем относительный путь от корня проекта
            rel_path = f"photos/{file.name}"
            all_photos.add(rel_path)
    
    print(f"Найдено файлов в папке photos/: {len(all_photos)}")
    return all_photos

def delete_unused_photos(unused_photos, photos_dir='photos'):
    """Удаляет неиспользуемые фотографии"""
    deleted_count = 0
    errors_count = 0
    
    for photo_path in unused_photos:
        # Получаем имя файла
        filename = photo_path.replace('photos/', '')
        file_path = Path(photos_dir) / filename
        
        if file_path.exists():
            try:
                file_path.unlink()
                print(f"Удален: {filename}")
                deleted_count += 1
            except Exception as e:
                print(f"Ошибка при удалении {filename}: {e}")
                errors_count += 1
        else:
            print(f"Предупреждение: файл {filename} не найден")
    
    return deleted_count, errors_count

def main():
    print("=" * 60)
    print("Очистка неиспользуемых фотографий")
    print("=" * 60)
    print()
    
    # Получаем списки файлов
    used_photos = get_used_photos()
    all_photos = get_all_photos()
    
    # Находим неиспользуемые файлы
    unused_photos = all_photos - used_photos
    
    print()
    print(f"Всего файлов: {len(all_photos)}")
    print(f"Используется: {len(used_photos)}")
    print(f"Не используется: {len(unused_photos)}")
    print()
    
    if not unused_photos:
        print("Отлично! Все фотографии используются.")
        return
    
    # Показываем список неиспользуемых файлов
    print("Неиспользуемые файлы:")
    for photo in sorted(unused_photos):
        print(f"  - {photo}")
    print()
    
    # Спрашиваем подтверждение
    response = input(f"Удалить {len(unused_photos)} неиспользуемых файлов? (yes/no): ")
    if response.lower() not in ['yes', 'y', 'да', 'д']:
        print("Отмена операции.")
        return
    
    # Удаляем файлы
    print()
    print("Удаление файлов...")
    deleted_count, errors_count = delete_unused_photos(unused_photos)
    
    print()
    print("=" * 60)
    print(f"Завершено!")
    print(f"Удалено файлов: {deleted_count}")
    if errors_count > 0:
        print(f"Ошибок: {errors_count}")
    print("=" * 60)

if __name__ == '__main__':
    main()

