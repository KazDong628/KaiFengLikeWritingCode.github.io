---
published: false
layout: archive
title: "Sitemap"
permalink: /sitemap/
author_profile: true
---
published: false

{% include base_path %}

以下按照主导航顺序列出网站内容，方便访客快速导航。

{% assign nav = site.data.navigation.main %}

{% for item in nav %}
  {% assign url = item.url %}
  {% assign key = url | remove_first: "/" | remove: "/" %}
  <h2>{{ item.title }}</h2>
  <ul>
    {% if key == "year-archive" %}
      {%- comment -%} 博客文章列表 {%- endcomment -%}
      {% for post in site.posts %}
        <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
      {% endfor %}

    {% else %}
      {% assign coll = site.collections[key] %}
      {% if coll and coll.output %}
        {%- comment -%} 渲染集合文档 {%- endcomment -%}
        {% for doc in coll.docs %}
          <li><a href="{{ doc.url | relative_url }}">{{ doc.title }}</a></li>
        {% endfor %}

      {% else %}
        {%- comment -%} 渲染普通页面 {%- endcomment -%}
        {% assign p = site.pages | where: "url", item.url | first %}
        {% if p %}
          <li><a href="{{ p.url | relative_url }}">{{ p.title }}</a></li>
        {% endif %}
      {% endif %}
    {% endif %}
  </ul>
{% endfor %}
